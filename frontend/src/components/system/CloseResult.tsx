import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { StateGlyph } from "./StateGlyph";

/** CloseResultLine is one part of the closing: what it did, what it says and, when there is, what to do or what git said. */
export interface CloseResultLine {
  outcome: "done" | "skipped" | "failed";
  text: string;
  /** mono ends the text in mono: a path or a branch. */
  mono?: string;
  /** after is what to do, under the text. */
  after?: string;
  /** detail is what git said, under the text, in mono. */
  detail?: string;
}

export interface CloseResultProps {
  legend: string;
  time?: string;
  /** label names the group for the reader. */
  label: string;
  lines: readonly CloseResultLine[];
  /** children come after the lines: a notice and the block of what stayed on disk. */
  children?: ReactNode;
}

function Mark({ outcome }: { outcome: CloseResultLine["outcome"] }) {
  if (outcome === "done") return <Icon icon={ICONS.done} size="sm" className="text-ink-3" />;
  if (outcome === "failed") return <StateGlyph state="error" size="sm" />;
  return (
    <span aria-hidden="true" className="font-bold text-ink-3">
      –
    </span>
  );
}

/** CloseResult is what the closing of a task did, part by part, in a sunken block. */
export function CloseResult({ legend, time, label, lines, children }: CloseResultProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is a form control group; this is a read-only block
    <div
      role="group"
      aria-label={label}
      className="rounded-md bg-surface-0 px-(--space-4) pt-(--space-2) pb-(--space-2-5)"
    >
      <div className="flex items-baseline justify-between gap-(--space-2)">
        <span className="text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) text-ink-3 uppercase">
          {legend}
        </span>
        {time !== undefined && (
          <span className="text-(length:--text-micro) leading-(--leading-micro) text-ink-4">
            {time}
          </span>
        )}
      </div>
      <ul
        // biome-ignore lint/a11y/noRedundantRoles: WebKit drops list semantics
        role="list"
        className="m-0 list-none p-0"
      >
        {lines.map((line, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: the lines are a fixed list of parts
            key={index}
            className="grid grid-cols-[var(--icon)_minmax(0,1fr)] items-baseline gap-x-(--space-2) border-t border-line-1 py-(--space-1-5) text-(length:--text-meta) leading-(--leading-meta) first:border-t-0"
          >
            <span className="grid place-items-center">
              <Mark outcome={line.outcome} />
            </span>
            <span
              className={cn(
                "min-w-0 wrap-anywhere",
                line.outcome === "skipped" ? "text-ink-2" : "text-ink-1",
              )}
            >
              {line.text}
              {line.mono !== undefined && (
                <>
                  {" "}
                  <span className="font-mono">{line.mono}</span>
                </>
              )}
            </span>
            {line.after !== undefined && (
              <span className="col-start-2 min-w-0 text-ink-3 wrap-anywhere">{line.after}</span>
            )}
            {line.detail !== undefined && (
              <span className="col-start-2 min-w-0 font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-3 wrap-anywhere">
                {line.detail}
              </span>
            )}
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}
