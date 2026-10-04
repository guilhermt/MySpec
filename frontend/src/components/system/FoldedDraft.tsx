import type { KeyboardEvent, ReactElement } from "react";
import type { DraftStateView } from "@/components/system/draft-views";
import { cn } from "@/lib/utils";
import { Badge } from "./Badge";
import { CutText } from "./CutText";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { Spinner } from "./Spinner";
import { StateGlyph } from "./StateGlyph";
import { Tooltip } from "./Tooltip";

/** REVISED_TIP is what Revised says of a draft, folded and open. */
export const REVISED_TIP =
  "The agent revised this draft. The earlier version is in the marker Drafts revised.";

/**
 * DraftGlyph is the sign before the state of a draft: ⧗, ✓, ◆, ◇, the spinner, or the pencil of a
 * draft a revision changed. spacer keeps the place of the sign when there is none, for a list whose
 * texts line up.
 */
export function DraftGlyph({
  glyph,
  spacer = false,
}: {
  glyph: DraftStateView["glyph"] | "pencil";
  spacer?: boolean;
}): ReactElement | null {
  switch (glyph) {
    case "hold":
      return <Icon icon={ICONS.waiting} size="sm" tone="muted" />;
    case "check":
      return <Icon icon={ICONS.done} size="sm" tone="muted" />;
    case "error":
      return <StateGlyph state="error" size="sm" />;
    case "blocked":
      return <StateGlyph state="blocked" size="sm" />;
    case "spinner":
      return <Spinner />;
    case "pencil":
      return <Icon icon={ICONS.revised} size="sm" tone="muted" />;
    case null:
      return spacer ? <span aria-hidden="true" className="size-(--icon-sm) shrink-0" /> : null;
  }
}

/** RevisedBadge is Revised with the pencil and what it means in the tooltip. */
export function RevisedBadge(): ReactElement {
  return (
    <Tooltip content={REVISED_TIP}>
      <Badge icon={ICONS.revised} className="shrink-0">
        Revised
      </Badge>
    </Tooltip>
  );
}

export interface FoldedDraftProps {
  id: string;
  number: number;
  /** kind is "New card", "Epic", "Update". */
  kind: string;
  revised: boolean;
  title: string;
  /** muted draws the title in --ink-3: a discarded draft. */
  muted: boolean;
  line2: string;
  state: { text: string; glyph: DraftStateView["glyph"]; strong: boolean; error: boolean };
  /** name is the accessible name: "Draft 3 of 5: …". */
  name: string;
  tabStop: boolean;
  /** requestTarget marks it as what the request bar names: data-request-target. */
  requestTarget: boolean;
  /** onOpen opens it: a click or Enter. */
  onOpen: () => void;
}

const META = "text-(length:--text-meta) leading-(--leading-meta)";

/**
 * FoldedDraft is a draft of the drafts card closed to two lines: the kind, the title and the state,
 * then the fields. A click or Enter opens it; the arrows and the decision keys are the card's.
 */
export function FoldedDraft({
  id,
  number,
  kind,
  revised,
  title,
  muted,
  line2,
  state,
  name,
  tabStop,
  requestTarget,
  onOpen,
}: FoldedDraftProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.target !== event.currentTarget) return;
    event.preventDefault();
    onOpen();
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset draws a frame and a legend the card does not want
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the draft says whether it is open or folded, as the material names it
    <div
      role="group"
      aria-label={name}
      aria-expanded={false}
      tabIndex={tabStop ? 0 : -1}
      data-card-item={id}
      data-request-target={requestTarget ? "" : undefined}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className={cn(
        "relative grid cursor-pointer grid-cols-[var(--key-size)_minmax(0,1fr)] gap-x-(--space-2) rounded-sm px-(--space-3) py-(--space-2) text-(length:--text-ui) leading-(--leading-ui) outline-none transition-[background-color] duration-(--duration-fast) ease-standard hover:bg-veil-hover focus-visible:focus-ring active:bg-veil-press",
        state.error && "error-rail-bar",
      )}
    >
      <span
        aria-hidden="true"
        className="text-right font-mono text-(length:--text-micro) leading-(--leading-ui) text-ink-3 tabular-nums"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-(--space-2)">
          <Badge className="shrink-0">{kind}</Badge>
          {revised && <RevisedBadge />}
          <CutText
            text={title}
            className={cn("grow font-medium", muted ? "text-ink-3" : "text-ink-1")}
          />
          <span
            {...(state.glyph === "spinner" ? { role: "status" } : {})}
            className={cn(
              "ml-auto inline-flex max-w-1/2 min-w-0 shrink-0 items-center gap-(--space-1-5)",
              META,
              state.error
                ? "text-state-error"
                : state.strong
                  ? "font-medium text-ink-1"
                  : "text-ink-3",
            )}
          >
            <DraftGlyph glyph={state.glyph} />
            <CutText text={state.text} />
          </span>
        </div>
        {line2 !== "" && <CutText text={line2} className={cn(META, "text-ink-3")} />}
      </div>
    </div>
  );
}
