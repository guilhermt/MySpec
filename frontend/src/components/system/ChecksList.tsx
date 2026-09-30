import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { Link } from "./Link";
import { Shimmer } from "./Shimmer";
import { StateGlyph } from "./StateGlyph";
import { Tooltip } from "./Tooltip";

/** CheckGlyph is the glyph of a check: passed, skipped or neutral, failed, running, queued. */
export type CheckGlyph = "done" | "doneFaint" | "error" | "work" | "todo";

/** CheckRowView is one check as the list draws it, with its duration ready. */
export interface CheckRowView {
  name: string;
  /** word is the state: passed, skipped, neutral, failed, running, queued. */
  word: string;
  glyph: CheckGlyph;
  /** tooltip is the conclusion of GitHub on a failed check. */
  tooltip: string | null;
  /** duration is "1m 52s", or "—" for a check with no times. */
  duration: string;
  /** url links the name to the check on GitHub; "" leaves the name plain text. */
  url: string;
}

export interface ChecksListProps {
  /** summary is "3 of 5 passed · 2 not finished", "Not read yet" or "No checks". */
  summary: string;
  rows: readonly CheckRowView[];
  /**
   * live draws the wait for the checks in place of the summary: the dashed glyph, the header
   * ("Waiting for checks · 4 of 6 passed", "No checks"), or checking GitHub in a shimmer while
   * reading, and the age of the reading with its exact time in the tooltip. action sits at the right
   * of the age (Refresh) and foot is what is still missing, at the bottom of the block.
   */
  live?: {
    header: string;
    age: string;
    ageTooltip: string;
    reading: boolean;
    action?: ReactNode;
    foot?: string;
  };
  /**
   * trailing is what the summary line says at its right: the age of the reading ("read 2m ago"), or
   * the failure of the reading in the error ink. It has the exact time in the tooltip when it has one.
   */
  trailing?: { text: string; tooltip?: string; error?: boolean };
  /** onOpen opens the url of a check in the browser, since nothing navigates inside the webview. */
  onOpen: (url: string) => void;
}

/** WORDS paints the word of a state that stands out: the failure, and the check that runs. */
const WORDS: Partial<Record<CheckGlyph, string>> = {
  error: "font-medium text-state-error",
  work: "font-medium text-ink-1",
};

/** Trailing is the age of the reading, or its failure, at the right of the summary. */
function Trailing({ text, tooltip, error }: NonNullable<ChecksListProps["trailing"]>) {
  const span = (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        error === true ? "text-state-error" : "text-ink-4",
      )}
    >
      {text}
    </span>
  );
  return tooltip === undefined ? span : <Tooltip content={tooltip}>{span}</Tooltip>;
}

/** Glyph is the sign of a check in its column. */
function Glyph({ glyph }: { glyph: CheckGlyph }) {
  if (glyph === "done" || glyph === "doneFaint") {
    return (
      <Icon
        icon={ICONS.done}
        size="sm"
        className={glyph === "done" ? "text-ink-3" : "text-ink-4"}
      />
    );
  }
  return <StateGlyph state={glyph} size="sm" />;
}

/**
 * ChecksList is the checks of a pull request, by name, in a panel: the summary on top and one row per
 * check with its glyph, the name in mono, the state and the duration on the right. A check with a url
 * names itself as an external link, which onOpen opens; without one it stays plain text. The live
 * variant is the wait for the checks: a sunken block with the live header, the rows and, when there is something missing, a foot.
 */
export function ChecksList({ summary, rows, onOpen, live, trailing }: ChecksListProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-(--space-1) text-(length:--text-meta) leading-(--leading-meta)",
        live !== undefined && "rounded-md bg-surface-0 px-(--space-3) py-(--space-2)",
      )}
    >
      {live !== undefined ? (
        <div className="flex items-center gap-(--space-2)">
          <StateGlyph state="github" size="sm" />
          <p className="min-w-0 flex-1 text-ink-2">
            {live.reading ? <Shimmer>checking GitHub</Shimmer> : live.header}
          </p>
          <Tooltip content={live.ageTooltip}>
            <span className="whitespace-nowrap text-ink-4 tabular-nums">{live.age}</span>
          </Tooltip>
          {live.action}
        </div>
      ) : trailing === undefined ? (
        <p className="text-ink-2">{summary}</p>
      ) : (
        <div className="flex items-baseline gap-(--space-2)">
          <p className="min-w-0 flex-1 text-ink-2">{summary}</p>
          <Trailing {...trailing} />
        </div>
      )}
      {rows.length > 0 && (
        <ul aria-label="Checks" className="flex flex-col">
          {rows.map((row, index) => {
            const word = (
              <span className={cn("whitespace-nowrap text-ink-3", WORDS[row.glyph])}>
                {row.word}
                {row.tooltip !== null && <span className="sr-only"> · {row.tooltip}</span>}
              </span>
            );
            const name =
              row.url !== "" ? (
                <Link
                  href={row.url}
                  external
                  onClick={(event) => {
                    event.preventDefault();
                    onOpen(row.url);
                  }}
                  className="min-w-0 truncate font-mono text-(length:--text-micro)"
                >
                  {row.name}
                </Link>
              ) : (
                <span className="truncate font-mono text-(length:--text-micro) text-ink-1">
                  {row.name}
                </span>
              );
            return (
              <li
                key={row.url !== "" ? row.url : `${row.name}-${index}`}
                data-glyph={row.glyph}
                className="grid min-h-(--size-control-sm) grid-cols-[var(--icon)_minmax(0,1fr)_auto_auto] items-center gap-(--space-2)"
              >
                <span className="grid place-items-center">
                  <Glyph glyph={row.glyph} />
                </span>
                {name}
                {row.tooltip !== null ? <Tooltip content={row.tooltip}>{word}</Tooltip> : word}
                <span className="min-w-(--space-12) text-right whitespace-nowrap text-ink-4 tabular-nums">
                  {row.duration}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {live?.foot !== undefined && <p className="pt-(--space-1) text-ink-3">{live.foot}</p>}
    </div>
  );
}
