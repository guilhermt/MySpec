import { bodyDiff, type DiffLine } from "@/features/discussion/drafts-card";
import { cn } from "@/lib/utils";

export interface DraftDiffProps {
  /** current is the body the card has on GitHub, next the one the draft writes. */
  current: string;
  next: string;
}

// The mark a line carries, in colour and in the character that opens it.
const MARKS: Record<DiffLine["kind"], { prefix: string; className: string }> = {
  added: { prefix: "+", className: "bg-[var(--status-success)]/15" },
  removed: { prefix: "-", className: "bg-destructive/15" },
  same: { prefix: " ", className: "" },
};

/** DraftDiff is what an update does to the body of a card, line by line. */
export function DraftDiff({ current, next }: DraftDiffProps) {
  const lines = bodyDiff(current, next);

  return (
    <section
      aria-label="Changes to the body"
      className="max-h-72 overflow-auto rounded-lg border p-2 font-mono text-xs select-text"
    >
      {lines.map((line, index) => {
        const mark = MARKS[line.kind];
        return (
          // The lines of a body have no identity of their own: two equal lines
          // are two lines, and the place in the diff is what tells them apart.
          // biome-ignore lint/suspicious/noArrayIndexKey: a line is its position
          <div key={index} className={cn("whitespace-pre-wrap", mark.className)}>
            {`${mark.prefix}${line.text}`}
          </div>
        );
      })}
    </section>
  );
}
