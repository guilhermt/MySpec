import { cn } from "@/lib/utils";
import { Shimmer } from "./Shimmer";
import { StateGlyph } from "./StateGlyph";

/** StepperGlyph is the state glyph of the pill; null draws no glyph and no divider. */
export type StepperGlyph = "work" | "wait" | "error" | "close" | "github" | "paused" | null;

/** PillView is what the pill of the current stage says. */
export interface PillView {
  /** name is the stage: Implementation. */
  name: string;
  /** position is where the stage is: "3/7", "pass 2" in the PR review, "" without one. */
  position: string;
  /** qualifier follows the position: "pass 2", "round 1", "Manual", "committing", "". */
  qualifier: string;
  /** keepsQualifier puts the qualifier in the place of the position, and it never gives way (One-Shot). */
  keepsQualifier: boolean;
  glyph: StepperGlyph;
  /** word is the state: "working", "checks 3/5", "paused", "" with a situation or idle. */
  word: string;
  /** shimmer glows over the word of a reading without a result, like checking GitHub. */
  shimmer: boolean;
  /** paused draws the neutral pill. */
  paused: boolean;
  /** state is the state in the accessible name: "Implementer working", "paused since 14:52". */
  state: string;
}

export interface PillProps {
  pill: PillView;
}

/** GIVES_WAY hides a part below 1040px of main area, keeping it for the reader. */
const GIVES_WAY = "@max-[1040px]/main:sr-only";

/**
 * Pill is the current stage of the stepper: the name, the position, and after a divider the glyph and
 * the word of the state. It is not a button. Below 1040px of main area the qualifier and the word give
 * way, save a qualifier that stands for the position.
 */
export function Pill({ pill }: PillProps) {
  const qualifier = pill.qualifier !== "" && (
    <span className={cn(!pill.keepsQualifier && GIVES_WAY)}>
      {pill.position !== "" && " · "}
      {pill.qualifier}
    </span>
  );
  const light = pill.glyph === "work" || pill.glyph === "github";
  return (
    <span
      data-paused={pill.paused || undefined}
      className={cn(
        "inline-flex h-(--size-control-sm) items-center gap-(--space-2) rounded-(--radius-pill) px-(--space-3) whitespace-nowrap @max-[1040px]/main:px-(--space-2-5)",
        pill.paused
          ? "bg-surface-0 shadow-[inset_0_0_0_var(--border)_var(--line-2)]"
          : "bg-brand-tint-plane shadow-[inset_0_0_0_var(--border)_var(--brand-marker-ring)]",
      )}
    >
      <span className={cn("font-semibold", pill.paused ? "text-ink-2" : "text-brand-ink")}>
        {pill.name}
      </span>
      {(pill.position !== "" || pill.qualifier !== "") && (
        <span className="text-ink-2 tabular-nums">
          {pill.position}
          {qualifier}
        </span>
      )}
      {pill.glyph !== null && (
        <>
          <span
            aria-hidden="true"
            className="h-(--space-3) w-(--border) shrink-0 bg-brand-marker-ring"
          />
          <StateGlyph state={pill.glyph} size="sm" />
        </>
      )}
      {pill.word !== "" && (
        <span className={cn(light ? "font-normal" : "font-medium", GIVES_WAY)}>
          {pill.shimmer ? <Shimmer>{pill.word}</Shimmer> : pill.word}
        </span>
      )}
    </span>
  );
}
