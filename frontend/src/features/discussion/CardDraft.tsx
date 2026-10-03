import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Draft } from "@/components/system/Draft";
import type { DependencyView } from "@/components/system/draft-views";
import { isTyping } from "@/components/system/keys";
import { Markdown } from "@/features/chat/Markdown";
import { DraftEditor } from "@/features/discussion/DraftEditor";
import { kindLabel } from "@/features/discussion/discussion-status";
import {
  accessibleName,
  bodyDiff,
  type CardEntry,
  type CardRefresh,
  decisionOf,
  dependencyViews,
  diffCount,
  draftStateOf,
  fieldsLine,
  gestureLineOf,
  onGitHub,
  warningsOf,
} from "@/features/discussion/drafts-card";
import { STALE_CARD_MS } from "@/lib/boards";
import { draftTitle } from "@/lib/drafts";
import { messageOf } from "@/lib/errors";
import { focusDraft } from "@/lib/focus";
import { shortName } from "@/lib/repositories";
import { asDraftDecision, asDraftKind, type DiscussionSummary } from "@/lib/wails";
import { openExternal, refreshCard, retryPublish } from "@/store/actions";

export interface CardDraftProps {
  discussion: DiscussionSummary;
  entry: CardEntry;
  /** total is how many drafts the card holds: "Draft 3 of 5". */
  total: number;
  now: number;
  /** target is the draft the request bar names, and whether it is its Retry. */
  target: { draft: string; retry: boolean } | null;
  editing: boolean;
  /** decide is the click of Approve or Discard, through the lock and the advance of the card. */
  decide: (key: "approve" | "discard") => void;
  onEdit: () => void;
  onDone: () => void;
}

/**
 * CardDraft is the open draft of the drafts card: it reads a draft of the discussion into the
 * Draft of the system, reads again the card an update changes, and holds Retry and the editor.
 */
export function CardDraft({
  discussion,
  entry,
  total,
  now,
  target,
  editing,
  decide,
  onEdit,
  onDone,
}: CardDraftProps) {
  const { draft } = entry;
  const kind = asDraftKind(draft.kind);
  const [refresh, setRefresh] = useState<CardRefresh>({ kind: "fresh" });
  const [retrying, setRetrying] = useState(false);

  // The reading of the card an update changes is read again once per revision of the draft, as it
  // opens: what it says it changes has to be what the card has now.
  const card = draft.card;
  const current = draft.current;
  const stale =
    current !== null && card !== null && Date.now() - Date.parse(current.readAt) > STALE_CARD_MS;
  const refreshedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!stale || card === null || refreshedFor.current === draft.revision) {
      return;
    }
    refreshedFor.current = draft.revision;
    setRefresh({ kind: "refreshing" });
    void refreshCard(discussion.boardId, card.key)
      .then(() => setRefresh({ kind: "fresh" }))
      .catch((failure: unknown) => {
        // The message is a sentence of its own; the warning wraps it in another.
        setRefresh({ kind: "failed", reason: messageOf(failure).replace(/\.$/, "") });
      });
  }, [stale, card, draft.revision, discussion.boardId]);

  const reading: CardRefresh =
    kind === "update" && current === null && refresh.kind === "fresh"
      ? { kind: "missing" }
      : refresh;
  const changes =
    kind === "update" && current !== null
      ? (() => {
          const lines = bodyDiff(current.body, draft.body);
          return { lines, count: diffCount(lines) };
        })()
      : null;
  const decision = decisionOf(draft, discussion, editing);
  const requested = target?.draft === draft.id ? target : null;

  const onOpenDependency = (dependency: DependencyView) => {
    if (dependency.draft !== null) {
      focusDraft(dependency.draft, false);
    } else {
      void openExternal(dependency.url);
    }
  };

  const retry = () => {
    setRetrying(true);
    void retryPublish(discussion.id, draft.id).finally(() => setRetrying(false));
  };

  // E opens the edit of the open draft, from the draft or a control of it that is not a field.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (
      event.key.toLowerCase() !== "e" ||
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isTyping(event.target) ||
      editing ||
      !decision.shown ||
      decision.editReason !== null
    ) {
      return;
    }
    event.preventDefault();
    onEdit();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the key is the draft's own; the controls inside are the interactive elements
    <div onKeyDown={onKeyDown}>
      <Draft
        id={draft.id}
        number={entry.number}
        name={accessibleName(entry, total, draft, discussion, now)}
        current
        requestTarget={requested === null ? null : requested.retry ? "retry" : "draft"}
        kind={kindLabel(draft)}
        cardLink={
          kind === "update" && card !== null
            ? { label: `${shortName(card.repository)}#${card.number}`, url: card.url }
            : null
        }
        revised={draft.revised}
        title={draftTitle(draft)}
        untitled={draft.title.trim() === ""}
        epic={kind === "epic"}
        discarded={draft.decision === "discarded"}
        fields={fieldsLine(draft, discussion)}
        dependencies={dependencyViews(draft, discussion)}
        onGitHub={onGitHub(draft)}
        warnings={warningsOf(draft, reading)}
        refreshing={reading.kind === "refreshing"}
        body={
          <Markdown cutCode className="draft-body">
            {draft.body}
          </Markdown>
        }
        changes={changes}
        gesture={gestureLineOf(draft, discussion, editing)}
        state={draftStateOf(draft, now)}
        decision={{ ...decision, value: asDraftDecision(draft.decision) }}
        retry={
          draft.publishError === ""
            ? null
            : {
                disabledReason: discussion.publishing ? "A publication is running" : null,
                running: retrying,
              }
        }
        editor={
          editing ? <DraftEditor discussion={discussion} draft={draft} onDone={onDone} /> : null
        }
        onDecide={decide}
        onEdit={onEdit}
        onRetry={retry}
        onOpenDependency={onOpenDependency}
        onOpenLink={(url) => void openExternal(url)}
      />
    </div>
  );
}
