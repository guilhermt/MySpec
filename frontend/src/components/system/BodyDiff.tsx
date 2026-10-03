import type { DiffLine } from "@/components/system/draft-views";
import { cn } from "@/lib/utils";

export interface BodyDiffProps {
  lines: readonly DiffLine[];
}

/** MARKS are what opens each line, what the reader hears of it, and how it is drawn: no colour, colour is a signal. */
const MARKS: Record<DiffLine["kind"], { sign: string; said: string; className: string }> = {
  added: { sign: "+", said: "Added: ", className: "bg-veil-hover text-ink-1" },
  removed: { sign: "−", said: "Removed: ", className: "text-ink-3" },
  same: { sign: " ", said: "", className: "text-ink-2" },
};

/** BodyDiff is what an update does to the body of a card, line by line, in neutral ink. */
export function BodyDiff({ lines }: BodyDiffProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset draws a frame and a legend the diff does not want
    <div
      role="group"
      aria-label="Changes to the body"
      className="relative rounded-sm bg-surface-0 px-(--space-3) py-(--space-2) font-mono text-(length:--text-meta) leading-(--leading-meta) select-text [font-variant-ligatures:none]"
    >
      {lines.map((line, index) => {
        const mark = MARKS[line.kind];
        return (
          // The lines of a body have no identity of their own: the place tells two equal lines apart.
          // biome-ignore lint/suspicious/noArrayIndexKey: a line is its position
          <div key={index} className={cn("whitespace-pre-wrap break-words", mark.className)}>
            {mark.said !== "" && <span className="sr-only">{mark.said}</span>}
            <span aria-hidden="true">{`${mark.sign} `}</span>
            <span className={cn(line.kind === "removed" && "line-through")}>{line.text}</span>
          </div>
        );
      })}
    </div>
  );
}
