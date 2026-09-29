import { cn } from "@/lib/utils";
import { ICONS, type IconGlyph } from "./icons";
import type { GlyphState } from "./StateGlyph";
import { TimeChip } from "./TimeChip";
import { Tooltip } from "./Tooltip";

/** ItemKind is the kind of an item of the tree, which its type glyph tells. */
export type ItemKind = "task" | "one-shot" | "review" | "discussion";

/** ItemTone is what an item says about itself, from which its state glyph comes. */
export type ItemTone =
  | "error"
  | "wait"
  | "close"
  | "agent"
  | "app"
  | "github"
  | "paused"
  | "idle"
  | "archive";

/** ItemClock is what the right edge of the second line of an item shows. */
export type ItemClock =
  | { kind: "chip"; tone: "wait" | "error" | "close"; time: string; longTime: string }
  | { kind: "turn"; time: string; tooltip: string }
  | { kind: "word"; word: string };

/** ITEM_ICONS is the type glyph of each kind of item. */
export const ITEM_ICONS = {
  task: ICONS.task,
  "one-shot": ICONS.oneShot,
  review: ICONS.review,
  discussion: ICONS.discussion,
} as const satisfies Record<ItemKind, IconGlyph>;

/** TONE_GLYPHS is the state glyph of each tone. */
export const TONE_GLYPHS: Record<ItemTone, GlyphState> = {
  error: "error",
  wait: "wait",
  close: "close",
  archive: "close",
  agent: "work",
  app: "work",
  github: "github",
  paused: "paused",
  idle: "idle",
};

const MICRO = "text-(length:--text-micro) leading-(--leading-micro)";

/** ItemClockView is the clock of an item: the chip, the time of a turn, or the word of its state. */
export function ItemClockView({ clock }: { clock: ItemClock }) {
  switch (clock.kind) {
    case "chip":
      return <TimeChip tone={clock.tone} time={clock.time} longTime={clock.longTime} />;
    case "turn":
      return (
        <Tooltip content={clock.tooltip}>
          <span className={cn(MICRO, "whitespace-nowrap tabular-nums text-ink-3")}>
            {clock.time}
          </span>
        </Tooltip>
      );
    case "word":
      return <span className={cn(MICRO, "whitespace-nowrap text-ink-3")}>{clock.word}</span>;
  }
}
