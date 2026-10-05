import { type ReactElement, type ReactNode, useId, useState } from "react";
import type {
  DecisionView,
  DependencyView,
  DiffLine,
  DraftStateView,
  GestureLineView,
} from "@/components/system/draft-views";
import { cn } from "@/lib/utils";
import { Badge } from "./Badge";
import { BodyDiff } from "./BodyDiff";
import { Button } from "./Button";
import { DraftGlyph, RevisedBadge } from "./FoldedDraft";
import { GestureLine } from "./GestureLine";
import { ICONS } from "./icons";
import { Link } from "./Link";
import { LiveRegion } from "./LiveRegion";
import { SegmentedControl } from "./SegmentedControl";
import { Shimmer } from "./Shimmer";
import { StateGlyph } from "./StateGlyph";
import { Tooltip } from "./Tooltip";

export interface DraftProps {
  id: string;
  number: number;
  /** name and current: the accessible name and the ring of the current one. */
  name: string;
  current: boolean;
  /** requestTarget marks the draft, or its Retry, as what the request bar names: data-request-target; the Approve it asks for carries data-request-control. */
  requestTarget: "draft" | "approve" | "retry" | null;
  kind: string;
  /** cardLink is the card of an update: "gateway#461", opened on GitHub. */
  cardLink: { label: string; url: string } | null;
  revised: boolean;
  title: string;
  /** untitled draws "Untitled epic" in --ink-3. */
  untitled: boolean;
  epic: boolean;
  discarded: boolean;
  fields: string;
  dependencies: readonly DependencyView[];
  onGitHub: string;
  /** warnings are one per line; while refreshing, the last one is the reading of the card. */
  warnings: readonly string[];
  /** refreshing is the card of an update being read again: role status, with the glow. */
  refreshing: boolean;
  body: ReactNode;
  /** changes is the diff of an update, with its count; null for a card and an epic. */
  changes: { lines: readonly DiffLine[]; count: string } | null;
  gesture: GestureLineView | null;
  state: DraftStateView;
  decision: DecisionView & { value: "" | "approved" | "discarded" };
  /** retry is the Retry of a failed draft, primary sm; null without a failure. */
  retry: { disabledReason: string | null; running: boolean } | null;
  /** editor replaces the title, the fields and the body while editing; null otherwise. */
  editor: ReactNode | null;
  onDecide: (key: "approve" | "discard") => void;
  onEdit: () => void;
  onRetry: () => void;
  onOpenDependency: (dependency: DependencyView) => void;
  onOpenLink: (url: string) => void;
}

const META = "text-(length:--text-meta) leading-(--leading-meta)";

// RINGS are the ring of the draft, current or not, with the error rail of a failure inside it.
const RINGS = {
  rest: "shadow-[inset_0_0_0_var(--border)_var(--line-2)]",
  current: "shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]",
  restError:
    "pl-[calc(var(--space-3)+var(--error-rail))] shadow-[inset_var(--error-rail)_0_0_var(--state-error),inset_0_0_0_var(--border)_var(--line-2)]",
  currentError:
    "pl-[calc(var(--space-3)+var(--error-rail))] shadow-[inset_var(--error-rail)_0_0_var(--state-error),inset_0_0_0_var(--border)_var(--brand-ring)]",
} as const;

/** OutLink is a link that leaves the app: the caller opens it. */
function OutLink({
  label,
  url,
  onOpen,
}: {
  label: string;
  url: string;
  onOpen: (url: string) => void;
}): ReactElement {
  return (
    <Link
      href={url}
      external
      onClick={(event) => {
        event.preventDefault();
        onOpen(url);
      }}
    >
      {label}
    </Link>
  );
}

/** StateText is the state of the draft after its glyph, with the issue on GitHub as a link. */
function StateText({
  state,
  onOpenLink,
}: {
  state: DraftStateView;
  onOpenLink: (url: string) => void;
}): ReactElement {
  const text = state.open ?? "";
  const { link } = state;
  const at = link === null ? -1 : text.indexOf(link.label);
  return (
    <>
      <DraftGlyph glyph={state.glyph} />
      {link === null || at === -1 ? (
        <span>{text}</span>
      ) : (
        <span>
          {text.slice(0, at)}
          <OutLink label={link.label} url={link.url} onOpen={onOpenLink} />
          {text.slice(at + link.label.length)}
        </span>
      )}
    </>
  );
}

/**
 * Draft is the open draft of the drafts card: its kind, title, fields, dependencies, warnings and
 * body, the line of what the gesture publishes, and the decision with the state beside it. A, D and
 * E are the caller's; the clicks of Approve and Discard call onDecide.
 */
export function Draft({
  id,
  number,
  name,
  current,
  requestTarget,
  kind,
  cardLink,
  revised,
  title,
  untitled,
  epic,
  discarded,
  fields,
  dependencies,
  onGitHub,
  warnings,
  refreshing,
  body,
  changes,
  gesture,
  state,
  decision,
  retry,
  editor,
  onDecide,
  onEdit,
  onRetry,
  onOpenDependency,
  onOpenLink,
}: DraftProps) {
  const gestureId = useId();
  const reasonId = useId();
  const editReasonId = useId();
  const [reading, setReading] = useState<"body" | "changes">("body");
  const editing = editor !== null;
  const line = editing ? null : gesture;
  const failed = state.glyph === "error";
  const reason = decision.approveReason ?? decision.discardReason;
  // The gesture line already says why Approve waits when it carries the same words.
  const reasonInLine = reason !== null && line !== null && line.text === reason;
  // The reason takes the place of the state, but a draft in the race or a failed one keeps its state:
  // the one publishing, and an approved one waiting for its turn while the race holds Edit.
  const inRace =
    state.glyph === "spinner" || (decision.value === "approved" && decision.editReason !== null);
  const reasonShown = reason !== null && !reasonInLine && !inRace && !failed;
  const approveDescription =
    decision.approveReason !== null && !reasonInLine
      ? reasonId
      : line !== null
        ? gestureId
        : undefined;
  const decided = decision.value !== "";

  const stateLine = (
    <LiveRegion
      kind="status"
      className={cn(
        "inline-flex min-w-0 items-center gap-(--space-1-5)",
        META,
        failed ? "text-state-error" : state.strong ? "font-medium text-ink-1" : "text-ink-2",
      )}
    >
      <StateText state={state} onOpenLink={onOpenLink} />
    </LiveRegion>
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset draws a frame and a legend the card does not want
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the draft says whether it is open or folded, as the material names it
    <div
      role="group"
      aria-label={name}
      aria-expanded={true}
      tabIndex={current ? 0 : -1}
      data-card-item={id}
      data-current={current ? "" : undefined}
      data-request-target={
        requestTarget === "draft" || requestTarget === "approve" ? "" : undefined
      }
      className={cn(
        // The scroll margin keeps the head of a tall draft below the fade at the top of a conversation.
        "relative grid scroll-mt-(--fade) grid-cols-[var(--key-size)_minmax(0,1fr)] gap-x-(--space-2) rounded-md bg-surface-2 p-(--space-3) outline-none focus-visible:focus-ring",
        RINGS[`${current ? "current" : "rest"}${failed ? "Error" : ""}`],
      )}
    >
      <span
        aria-hidden="true"
        className="text-right font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-3 tabular-nums"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-col gap-(--space-2)">
        <div className="flex flex-wrap items-center gap-(--space-2)">
          <Badge>
            {kind}
            {cardLink !== null && (
              <Tooltip content={`Open ${cardLink.label} on GitHub`}>
                <OutLink label={cardLink.label} url={cardLink.url} onOpen={onOpenLink} />
              </Tooltip>
            )}
          </Badge>
          {revised && <RevisedBadge />}
        </div>
        {editing ? (
          editor
        ) : (
          <>
            <p
              className={cn(
                "font-semibold break-words",
                epic
                  ? "text-(length:--text-body) leading-(--leading-body)"
                  : "text-(length:--text-ui) leading-(--leading-ui)",
                untitled ? "text-ink-3" : discarded ? "text-ink-2" : "text-ink-1",
              )}
            >
              {title}
            </p>
            {fields !== "" && <p className={cn(META, "text-ink-3")}>{fields}</p>}
            {(dependencies.length > 0 || onGitHub !== "") && (
              <p className={cn(META, "text-ink-2")}>
                {dependencies.length > 0 && "Depends on "}
                {dependencies.map((dependency, index) => {
                  const link = (
                    <Link
                      href={dependency.url !== "" ? dependency.url : "#"}
                      external={dependency.draft === null}
                      onClick={(event) => {
                        event.preventDefault();
                        onOpenDependency(dependency);
                      }}
                    >
                      {dependency.title}
                    </Link>
                  );
                  return (
                    <span key={`${dependency.draft ?? dependency.url}:${dependency.title}`}>
                      {index > 0 && ", "}
                      {dependency.linked ? (
                        <Tooltip content="Linked on GitHub">{link}</Tooltip>
                      ) : (
                        link
                      )}
                    </span>
                  );
                })}
                {onGitHub !== "" && (
                  <span className="text-ink-3">
                    {`${dependencies.length > 0 ? " · " : ""}On GitHub: ${onGitHub}`}
                  </span>
                )}
              </p>
            )}
          </>
        )}
        {warnings.length > 0 && (
          <div className="flex flex-col gap-(--space-1)">
            {warnings.map((warning, index) => {
              const live = refreshing && index === warnings.length - 1;
              return (
                <p key={warning} className={cn("flex gap-(--space-2) text-ink-2", META)}>
                  <span className="inline-flex h-(--leading-meta) shrink-0 items-center">
                    <StateGlyph state="blocked" size="sm" />
                  </span>
                  <LiveRegion kind="status">
                    {live ? <Shimmer>{warning}</Shimmer> : warning}
                  </LiveRegion>
                </p>
              );
            })}
          </div>
        )}
        {!editing && (
          <div className="flex flex-col gap-(--space-2) border-t border-line-1 pt-(--space-3)">
            {changes !== null && (
              <SegmentedControl
                label="What to read"
                size="sm"
                value={reading}
                options={[
                  { value: "body", label: "Body" },
                  { value: "changes", label: "Changes", detail: changes.count },
                ]}
                onValueChange={setReading}
              />
            )}
            {changes !== null && reading === "changes" ? <BodyDiff lines={changes.lines} /> : body}
          </div>
        )}
        {line !== null && <GestureLine id={gestureId} view={line} />}
        {state.created !== null && (
          <p className={cn("inline-flex items-center gap-(--space-1-5) text-ink-2", META)}>
            <DraftGlyph glyph="check" />
            <span>
              {"Created "}
              <OutLink label={state.created.label} url={state.created.url} onOpen={onOpenLink} />
            </span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-(--space-2)">
          {decision.shown && (
            <>
              <Button
                size="sm"
                icon={ICONS.done}
                shortcut="A"
                pressed={decision.value === "approved"}
                data-request-control={requestTarget === "approve" ? "" : undefined}
                disabled={decision.approveReason !== null}
                {...(approveDescription !== undefined ? { reasonId: approveDescription } : {})}
                onClick={() => onDecide("approve")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                shortcut="D"
                pressed={decision.value === "discarded"}
                disabled={decision.discardReason !== null}
                {...(decision.discardReason !== null ? { reasonId } : {})}
                onClick={() => onDecide("discard")}
              >
                Discard
              </Button>
            </>
          )}
          {reason !== null && !reasonInLine && (
            <span id={reasonId} className={reasonShown ? cn(META, "text-ink-3") : "sr-only"}>
              {reason}
            </span>
          )}
          {!reasonShown && state.open !== null && stateLine}
          {retry !== null && (
            <Tooltip content="Goes on from this draft; nothing is created twice">
              <Button
                variant="primary"
                size="sm"
                data-retry=""
                data-request-target={requestTarget === "retry" ? "" : undefined}
                loading={retry.running}
                loadingLabel="Retrying…"
                disabled={retry.disabledReason !== null}
                {...(retry.disabledReason !== null ? { disabledReason: retry.disabledReason } : {})}
                onClick={onRetry}
              >
                Retry
              </Button>
            </Tooltip>
          )}
          {/* The way to undo comes after the whole state, the Retry of a failure included. */}
          {decided && reason === null && decision.shown && state.open !== null && (
            <span className={cn(META, "text-ink-3")}>· click again to undo</span>
          )}
          {decision.shown && (
            <span className="ml-auto">
              <Tooltip
                content={decision.editReason ?? "Edit the title, the body and the fields"}
                {...(decision.editReason === null ? { shortcut: "E" } : {})}
              >
                <Button
                  variant="ghost"
                  size="xs"
                  shortcut="E"
                  disabled={decision.editReason !== null}
                  {...(decision.editReason !== null ? { reasonId: editReasonId } : {})}
                  onClick={onEdit}
                >
                  Edit
                </Button>
              </Tooltip>
              {decision.editReason !== null && (
                <span id={editReasonId} className="sr-only">
                  {decision.editReason}
                </span>
              )}
            </span>
          )}
        </div>
        {state.wayBack !== "" && <p className={cn(META, "text-ink-3")}>{state.wayBack}</p>}
      </div>
    </div>
  );
}
