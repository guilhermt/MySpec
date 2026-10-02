import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DecisionCard } from "@/components/system/DecisionCard";
import { FoldedDraft } from "@/components/system/FoldedDraft";
import { useNow } from "@/features/attention/useNow";
import { leaveDecisionCard } from "@/features/chat/useFeed";
import { CardDraft } from "@/features/discussion/CardDraft";
import { kindLabel } from "@/features/discussion/discussion-status";
import {
  accessibleName,
  advanceAfter,
  type CardEntry,
  cardEntries,
  decisionOf,
  draftStateOf,
  epicGroupLabel,
  foldedLine2,
  isDecided,
  isStarted,
  LOCK_MS,
} from "@/features/discussion/drafts-card";
import { draftTitle } from "@/lib/drafts";
import { focusDraft } from "@/lib/focus";
import { modalOpen } from "@/lib/layers";
import { asDraftKind, type DiscussionSummary } from "@/lib/wails";
import { decideDraft } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

// MINUTE is how often the times of the published drafts are read again.
const MINUTE = 60_000;

export interface DraftsCardProps {
  discussion: DiscussionSummary;
  /** target is the draft the request bar names, opened as the current one, and whether it is its Retry. */
  target: { draft: string; retry: boolean } | null;
}

// Slot holds a draft, open or folded. The two are different elements, so one that held the focus as
// it opened or folded would drop it: the slot gives it back to the one that takes its place. A
// control of the draft that leaves holding the focus, like the decision once the draft publishes,
// gives it back to the draft too. onFolded runs while the draft is folded: the edit of a draft that
// stops being the current one closes, and the focus stays where the user moved it.
function Slot({
  current,
  onFolded,
  children,
}: {
  current: boolean;
  onFolded?: (() => void) | undefined;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const held = useRef(false);
  const was = useRef(current);
  // The render still sees the DOM of the draft that is about to be replaced.
  held.current = root.current?.contains(document.activeElement) ?? false;
  useLayoutEffect(() => {
    if (!current) onFolded?.();
    const turned = was.current !== current;
    was.current = current;
    if (!held.current || (!turned && document.activeElement !== document.body)) return;
    const item = root.current?.querySelector<HTMLElement>("[data-card-item]");
    item?.focus();
    if (turned) item?.scrollIntoView?.({ block: "center" });
  });
  return <div ref={root}>{children}</div>;
}

// afterDialogs runs a focus once no dialog is on screen: a dialog that closes gives the focus back
// to what opened it, and the focus asked for has to come after.
function afterDialogs(focus: () => void, frames = 60): void {
  requestAnimationFrame(() => {
    if (modalOpen() && frames > 0) {
      afterDialogs(focus, frames - 1);
    } else {
      focus();
    }
  });
}

/**
 * DraftsCard is the drafts of the current round, decided one at a time: the neutral card of the
 * conversation, with the current draft open and the others folded to two lines. A and D decide the
 * draft in focus, E edits it; a gesture that publishes keeps the focus on the draft, and one that
 * does not moves on to the next to decide.
 */
export function DraftsCard({ discussion, target }: DraftsCardProps) {
  const now = useNow(MINUTE, true);
  const entries = cardEntries(discussion);
  const [editing, setEditing] = useState<{ id: string; revision: number } | null>(null);
  const refocus = useRef<string | null>(null);
  const request = useAppStore((state) => state.draftRequest);
  const clearDraftRequest = useAppStore((state) => state.clearDraftRequest);
  const round = discussion.round;

  // An edit closes when its draft leaves, the agent revises it or another draft becomes the current one.
  const editingEntry =
    editing === null
      ? undefined
      : entries.find(
          (entry) => entry.draft.id === editing.id && entry.draft.revision === editing.revision,
        );
  const editingId = editingEntry === undefined ? null : (editing?.id ?? null);
  useEffect(() => {
    if (editing !== null && editingEntry === undefined) {
      setEditing(null);
    }
  }, [editing, editingEntry]);

  // The edit that closes gives the focus back to its draft, once the draft is drawn again.
  useEffect(() => {
    if (editingId === null && refocus.current !== null) {
      focusDraft(refocus.current, false);
      refocus.current = null;
    }
  });
  const closeEdit = (id: string) => {
    refocus.current = id;
    setEditing(null);
  };

  // The draft a grouping asks for takes the focus once the card holds it.
  const requested =
    request?.discussionId === discussion.id &&
    entries.some((entry) => entry.draft.id === request.draftId)
      ? request.draftId
      : null;
  useEffect(() => {
    if (requested === null) return;
    clearDraftRequest();
    afterDialogs(() => focusDraft(requested, false));
  }, [requested, clearDraftRequest]);

  const drafts = entries.map((entry) => entry.draft);
  const onDecide = (id: string, key: "approve" | "discard"): "advance" | "stay" | "refused" => {
    const draft = drafts.find((each) => each.id === id);
    if (draft === undefined) return "refused";
    const view = decisionOf(draft, discussion, editingId === id);
    if ((key === "approve" ? view.approveReason : view.discardReason) !== null) return "refused";
    const decision = key === "approve" ? "approved" : "discarded";
    void decideDraft(discussion.id, id, draft.decision === decision ? "" : decision);
    return advanceAfter(draft, key);
  };

  const sections = entries.flatMap(({ draft }) => {
    if (asDraftKind(draft.kind) !== "epic") return [];
    const members = entries.filter((entry) => entry.epic?.id === draft.id);
    return members.length === 0
      ? []
      : [
          {
            head: draft.id,
            members: members.map((entry) => entry.draft.id),
            label: epicGroupLabel(draft, members.length),
          },
        ];
  });
  const byId = new Map<string, CardEntry>(entries.map((entry) => [entry.draft.id, entry]));

  return (
    <DecisionCard
      title={`Round ${round} · drafts`}
      count={entries.length}
      label={`Drafts of round ${round}`}
      items={entries.map(({ draft }) => ({
        id: draft.id,
        decided: isDecided(draft),
        disabled: isStarted(draft) || discussion.publishing,
      }))}
      sections={sections}
      lockMs={LOCK_MS}
      idle="none"
      ends
      preferred={target?.draft ?? null}
      onLeave={leaveDecisionCard}
      onDecide={onDecide}
      renderItem={(item, current, { tabStop, decide }) => {
        const entry = byId.get(item.id);
        if (entry === undefined) return null;
        const { draft } = entry;
        const name = accessibleName(entry, entries.length, draft, discussion, now);
        return (
          <Slot
            current={current}
            onFolded={editingId === draft.id ? () => setEditing(null) : undefined}
          >
            {current ? (
              <CardDraft
                discussion={discussion}
                entry={entry}
                total={entries.length}
                now={now}
                target={target}
                editing={editingId === draft.id}
                decide={decide}
                onEdit={() => setEditing({ id: draft.id, revision: draft.revision })}
                onDone={() => closeEdit(draft.id)}
              />
            ) : (
              <FoldedDraft
                id={draft.id}
                number={entry.number}
                kind={kindLabel(draft)}
                revised={draft.revised}
                title={draftTitle(draft)}
                muted={draft.decision === "discarded"}
                line2={foldedLine2(draft, discussion)}
                state={(() => {
                  const state = draftStateOf(draft, now);
                  return {
                    text: state.folded,
                    glyph: state.glyph,
                    strong: state.strong,
                    error: state.glyph === "error",
                  };
                })()}
                name={name}
                tabStop={tabStop}
                requestTarget={target?.draft === draft.id}
                onOpen={() => focusDraft(draft.id, false)}
              />
            )}
          </Slot>
        );
      }}
    />
  );
}
