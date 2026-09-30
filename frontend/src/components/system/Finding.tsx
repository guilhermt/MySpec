import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Link } from "./Link";
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
  onOpenLine: () => void;
  /** renderText draws the Markdown of the text: the system knows no Markdown renderer. */
  renderText: (text: string) => ReactNode;
}

/**
 * Finding is one finding of a review: what is wrong, where, and what the user said about it. Here it
 * is drawn as it stays once published or sent, without the decision and the edit.
 */
export function Finding({ model, current = false, onOpenLine, renderText }: FindingProps) {
  const { location } = model;
  const discarded = model.decision === "discarded";
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset draws a frame and a legend the card does not want
    <div
      role="group"
      aria-label={model.name}
      tabIndex={current ? 0 : -1}
      data-finding=""
      data-finding-id={model.id}
      data-decided={String(model.decision !== "")}
      data-disabled={model.disabled === null ? undefined : ""}
      className="grid grid-cols-[var(--key-size)_minmax(0,1fr)] gap-(--space-2) rounded-md p-(--space-3) shadow-[inset_0_0_0_var(--border)_var(--line-1)] outline-none focus-visible:focus-ring"
    >
      <span
        aria-hidden="true"
        className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3 tabular-nums"
      >
        {model.number}
      </span>
      <div className="flex min-w-0 flex-col gap-(--space-1)">
        <p
          className={cn(
            "text-(length:--text-ui) leading-(--leading-ui) font-semibold break-words",
            discarded ? "text-ink-2" : "text-ink-1",
            model.locationAsTitle && "font-mono text-(length:--text-meta) font-normal",
          )}
        >
          {model.title}
        </p>
        {!model.locationAsTitle &&
          (location.kind === "anchored" ? (
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
                className="w-fit font-mono text-(length:--text-meta) leading-(--leading-meta)"
              >
                {location.text}
              </Link>
            </Tooltip>
          ) : (
            <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
              {location.text}
            </p>
          ))}
        <div className="select-text">{renderText(model.text)}</div>
        {model.disabled !== null && (
          <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
            {model.disabled}
          </p>
        )}
      </div>
    </div>
  );
}
