import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { ICONS } from "./icons";
import { Link } from "./Link";
import { Spinner } from "./Spinner";
import { Textarea } from "./Textarea";
import { Tooltip } from "./Tooltip";

export type FindingDecision = "" | "approved" | "discarded";

export interface FindingView {
  /** id is what the card keys the finding by: "2" for finding 2. */
  id: string;
  number: number;
  /** name is the accessible name: "Finding 2 of 3: <title>. <file>, line 31. Not decided." */
  name: string;
  /** title is what the finding says is wrong; with locationAsTitle, the location takes its place. */
  title: string;
  locationAsTitle: boolean;
  location:
    | { kind: "anchored"; text: string; url: string; line: number; fileName: string }
    | { kind: "general"; text: string };
  /** text is the finding as the user left it, Markdown. */
  text: string;
  decision: FindingDecision;
  /** disabled is where the finding went once published or sent: "Inline comment · published 13:41"; null while it is decided on. */
  disabled: string | null;
}

export interface FindingProps {
  model: FindingView;
  /** current is the finding the card's one tab stop sits on. */
  current?: boolean;
  /** editNote is "Saved as you type. It goes to GitHub as you leave it." or the Apply one. */
  editNote?: string;
  editing?: boolean;
  /** draft is the text in the field while editing; the last saved text stays when it is empty. */
  draft?: string;
  saving?: boolean;
  error?: "decision" | "text" | null;
  onDecide?: (decision: FindingDecision) => void;
  onEdit?: () => void;
  onDraftChange?: (text: string) => void;
  onDraftBlur?: () => void;
  onDone?: () => void;
  onOpenLine: () => void;
  onOpenEditor?: () => void;
  onRetry?: () => void;
  /** renderText draws the Markdown of the text: the system knows no Markdown renderer. */
  renderText: (text: string) => ReactNode;
}

const META = "text-(length:--text-meta) leading-(--leading-meta)";

/** inField tells a key that comes from a text field, which is the field's own. */
function inField(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable)
  );
}

/**
 * Finding is one finding of a review: what is wrong, where, and what the user said about it, with the
 * decision on it and the way to edit its text. Once published or sent it is disabled: it says where
 * it went and decides nothing. A disabled finding needs none of the handlers of the decision and the
 * edit.
 */
export function Finding({
  model,
  current = false,
  editNote = "",
  editing = false,
  draft = "",
  saving = false,
  error = null,
  onDecide,
  onEdit,
  onDraftChange,
  onDraftBlur,
  onDone,
  onOpenLine,
  onOpenEditor,
  onRetry,
  renderText,
}: FindingProps) {
  const { location } = model;
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const discarded = model.decision === "discarded";
  const disabled = model.disabled !== null;
  const anchored = location.kind === "anchored";
  const emptyDraft = editing && draft.trim() === "";

  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const done = () => {
    onDone?.();
    root.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && editing) {
      event.preventDefault();
      done();
      return;
    }
    if (event.repeat || inField(event.target)) return;
    if (event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "e") {
      if (!anchored) return;
      event.preventDefault();
      onOpenEditor?.();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "o" && anchored) {
      event.preventDefault();
      onOpenLine();
    } else if (key === "e" && !disabled && !editing) {
      event.preventDefault();
      onEdit?.();
    }
  };

  const locationLink =
    location.kind === "anchored" ? (
      <span className="flex items-center gap-(--space-1)">
        <Tooltip
          content={`Open on GitHub, in Files changed, at line ${location.line}`}
          shortcut="O"
        >
          <Link
            href={location.url}
            external
            onClick={(event) => {
              event.preventDefault();
              onOpenLine();
            }}
            className={cn("min-w-0 font-mono", META)}
          >
            {location.text}
          </Link>
        </Tooltip>
        <IconButton
          icon={ICONS.openInEditor}
          label={`Open line ${location.line} of ${location.fileName} in VS Code`}
          tooltip="Open in VS Code at this line"
          shortcut="Ctrl+E"
          size="xs"
          onClick={() => onOpenEditor?.()}
        />
      </span>
    ) : (
      <p className={cn(META, "text-ink-3")}>{location.text}</p>
    );

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset draws a frame and a legend the card does not want
    <div
      ref={root}
      role="group"
      aria-label={model.name}
      tabIndex={current ? 0 : -1}
      data-finding=""
      data-finding-id={model.id}
      data-decided={String(model.decision !== "")}
      data-disabled={disabled ? "" : undefined}
      onKeyDown={onKeyDown}
      className={cn(
        "grid grid-cols-[var(--key-size)_minmax(0,1fr)] gap-(--space-2) rounded-md p-(--space-3) shadow-[inset_0_0_0_var(--border)_var(--line-1)] outline-none hover:shadow-[inset_0_0_0_var(--border)_var(--line-3)] focus-visible:focus-ring",
        current && "focus-within:shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]",
        error !== null && "shadow-[inset_0_0_0_var(--border)_var(--state-error)]",
      )}
    >
      <span aria-hidden="true" className={cn(META, "text-ink-3 tabular-nums")}>
        {model.number}
      </span>
      <div className="flex min-w-0 flex-col gap-(--space-1)">
        {model.locationAsTitle ? (
          locationLink
        ) : (
          <>
            <p
              className={cn(
                "text-(length:--text-ui) leading-(--leading-ui) font-semibold break-words",
                discarded ? "text-ink-2" : "text-ink-1",
              )}
            >
              {model.title}
            </p>
            {locationLink}
          </>
        )}
        {editing ? (
          <div className="flex flex-col gap-(--space-1)">
            <Textarea
              ref={field}
              rows={5}
              aria-label={`Text of finding ${model.number}`}
              aria-invalid={emptyDraft || undefined}
              value={draft}
              onChange={(event) => onDraftChange?.(event.target.value)}
              onBlur={onDraftBlur}
            />
            {emptyDraft && (
              <p className={cn(META, "text-state-error")}>Write the finding, or discard it.</p>
            )}
            <div className="flex items-center gap-(--space-2)">
              <p className={cn(META, "min-w-0 flex-1 text-ink-3")}>{editNote}</p>
              <Button variant="ghost" size="xs" onClick={done}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="select-text">{renderText(model.text)}</div>
        )}
        {disabled ? (
          <p className={cn(META, "text-ink-3")}>{model.disabled}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-(--space-2)">
            <Button
              size="sm"
              icon={ICONS.done}
              pressed={model.decision === "approved"}
              onClick={() => onDecide?.(model.decision === "approved" ? "" : "approved")}
            >
              Approve
            </Button>
            <Button
              size="sm"
              pressed={discarded}
              onClick={() => onDecide?.(discarded ? "" : "discarded")}
            >
              Discard
            </Button>
            {model.decision !== "" && (
              <span className={cn(META, "text-ink-3")}>
                {`${discarded ? "Discarded" : "Approved"} · click again to undo`}
              </span>
            )}
            {saving && (
              <span className={cn(META, "inline-flex items-center gap-(--space-1-5) text-ink-3")}>
                <Spinner />
                Saving…
              </span>
            )}
            {error !== null && (
              <span
                className={cn(META, "inline-flex items-center gap-(--space-1) text-state-error")}
              >
                {`Couldn't save the ${error === "decision" ? "decision" : "text"} ·`}
                <Button variant="ghost" size="xs" onClick={() => onRetry?.()}>
                  Try again
                </Button>
              </span>
            )}
            <span className="ml-auto">
              <Tooltip content="Edit" shortcut="E">
                <Button variant="ghost" size="xs" onClick={() => onEdit?.()}>
                  Edit
                </Button>
              </Tooltip>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
