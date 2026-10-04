import { cn } from "@/lib/utils";
import { StateGlyph } from "./StateGlyph";

export interface DependencyNoticeProps {
  model: {
    /** title is "Depends on #461". */
    title: string;
    issueTitle: string;
    meta: string;
  };
  /** outlined draws the outline a notice needs inside a sunken panel. */
  outlined?: boolean;
}

/**
 * DependencyNotice is a dependency the card has not satisfied: neutral and sunken, a warning that
 * never blocks, and so never amber.
 */
export function DependencyNotice({ model, outlined }: DependencyNoticeProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-(--space-0-5) rounded-md bg-surface-0 px-(--space-3) py-(--space-2) text-(length:--text-meta) leading-(--leading-meta)",
        outlined && "ring-1 ring-line-2",
      )}
    >
      <p className="text-ink-2">
        <StateGlyph state="blocked" className="mr-(--space-1-5) align-middle" />
        <span className="font-semibold text-ink-1">{model.title}</span> {model.issueTitle}
      </p>
      <p className="text-ink-2">{model.meta}</p>
    </div>
  );
}
