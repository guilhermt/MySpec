import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

/** GlyphState is each state a status glyph draws (components.md, Glifos). */
export type GlyphState =
  | "error"
  | "wait"
  | "close"
  | "work"
  | "github"
  | "paused"
  | "idle"
  | "blocked"
  | "todo";

export interface StateGlyphProps {
  state: GlyphState;
  size?: "md" | "sm";
  label?: string;
  className?: string;
}

/** SHAPES are the form of each glyph, as in specimen.html .st-*. */
const SHAPES: Record<Exclude<GlyphState, "work">, string> = {
  error: "rotate-45 rounded-(--radius-glyph) bg-state-error",
  wait: "rounded-full bg-state-wait-glyph shadow-[inset_0_0_0_var(--border)_var(--state-wait-ring)]",
  close: "rounded-full border-(length:--border-2) border-state-close",
  github: "rounded-full border border-dashed border-state-github",
  paused:
    "bg-[linear-gradient(90deg,var(--state-paused)_0_var(--glyph-bar),transparent_var(--glyph-bar)_calc(100%-var(--glyph-bar)),var(--state-paused)_calc(100%-var(--glyph-bar)))]",
  idle: "rounded-full border border-state-idle",
  blocked: "rotate-45 rounded-(--radius-glyph) border border-state-notice",
  todo: "rounded-full border border-line-deco",
};

/** StateGlyph is the small shape that carries a state next to its text label. */
export function StateGlyph({ state, size = "md", label, className }: StateGlyphProps) {
  const a11y = label !== undefined ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  const small = size === "sm";
  if (state === "work") {
    return (
      <span {...a11y} data-state={state} className={cn("inline-flex shrink-0", className)}>
        <Spinner {...(small ? { className: "size-(--glyph-sm)" } : {})} />
      </span>
    );
  }
  // The diamonds are drawn at --glyph-diamond, which equals --glyph-sm.
  const diamond = state === "error" || state === "blocked";
  return (
    <span
      {...a11y}
      data-state={state}
      className={cn(
        "inline-block shrink-0",
        small ? "size-(--glyph-sm)" : diamond ? "size-(--glyph-diamond)" : "size-(--glyph)",
        SHAPES[state],
        className,
      )}
    />
  );
}
