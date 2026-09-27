import { memo, useEffect, useRef } from "react";
import { ContextMeter } from "@/components/system/ContextMeter";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Kbd } from "@/components/system/Kbd";
import { Shimmer } from "@/components/system/Shimmer";
import { type GlyphState, StateGlyph } from "@/components/system/StateGlyph";
import { TimeChip } from "@/components/system/TimeChip";
import { Tooltip } from "@/components/system/Tooltip";
import type { ItemKind, ItemRow, RowFlash, RowTone } from "@/features/sidebar/sidebar-tree";
import { useFits } from "@/features/sidebar/useFits";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

export interface TreeRowProps {
  row: ItemRow;
  level: 2 | 3;
  /** selected is the row of the item on screen. */
  selected: boolean;
  /** isNext is the row Ctrl+J opens next. */
  isNext: boolean;
  flash: RowFlash | null;
  /** narrow is a sidebar under 330px, which takes the short forms and drops the meta. */
  narrow: boolean;
  tabIndex: 0 | -1;
}

/** TYPE_ICONS is the type glyph of each kind of item, on its row and on its block of the strip. */
export const TYPE_ICONS = {
  task: ICONS.task,
  "one-shot": ICONS.oneShot,
  review: ICONS.review,
  discussion: ICONS.discussion,
} as const satisfies Record<ItemKind, unknown>;

/** ROW_GLYPHS is the state glyph of each tone, on a row and on its block of the strip. */
export const ROW_GLYPHS: Record<RowTone, GlyphState> = {
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
// FAINT is the fourth ink of the quiet texts, which steps up to the third on the open row and on the
// pressed one: the fourth ink does not reach 4.5:1 over their veils.
const FAINT = "text-ink-4 group-active/row:text-ink-3";
// The invisible copy a cell measures its long content with. The row clips it, so a long copy never
// widens the tree into a sideways scroll.
const MEASURE = "invisible absolute whitespace-nowrap";

/** TreeRowView is a task, a review or a discussion of the tree, in its three lines. */
function TreeRowView({ row, level, selected, isNext, flash, narrow, tabIndex }: TreeRowProps) {
  const openTask = useAppStore((state) => state.openTask);
  const openReview = useAppStore((state) => state.openReview);
  const openDiscussion = useAppStore((state) => state.openDiscussion);
  const ref = useRef<HTMLDivElement>(null);
  const line1 = useRef<HTMLSpanElement>(null);
  const line1Measure = useRef<HTMLSpanElement>(null);
  const line2 = useRef<HTMLSpanElement>(null);
  const line2Measure = useRef<HTMLSpanElement>(null);
  const line3 = useRef<HTMLSpanElement>(null);
  const line3Measure = useRef<HTMLSpanElement>(null);
  const metaFits = useFits(line1, line1Measure, `${row.name} ${row.meta} ${row.waiting}`);
  const longFits = useFits(line2, line2Measure, `${row.line2.long} ${row.more?.count ?? ""}`);
  const line3Fits = useFits(line3, line3Measure, row.line3?.long ?? "");

  // The open row comes into view: the tree follows the item on screen.
  useEffect(() => {
    if (selected) {
      ref.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  const open = () => {
    if (row.itemKind === "review") {
      openReview(row.id);
    } else if (row.itemKind === "discussion") {
      openDiscussion(row.id);
    } else {
      openTask(row.id);
    }
  };
  const showMeta = !narrow && metaFits;
  const { clock, line3: work } = row;
  // The meta the line does not carry, dropped or taken by the Ctrl J key, goes in the tooltip.
  const metaOnLine = showMeta && !isNext;

  return (
    <Tooltip content={metaOnLine || row.meta === "" ? row.name : `${row.name} · ${row.meta}`}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the tree owns the keyboard of its rows */}
      <div
        ref={ref}
        role="treeitem"
        aria-level={level}
        aria-label={row.label + (isNext ? " Ctrl+J opens this next." : "")}
        aria-selected={selected}
        {...(selected ? { "aria-current": "page" as const } : {})}
        tabIndex={tabIndex}
        data-entry-id={row.id}
        data-tone={row.tone}
        {...(flash !== null ? { "data-flash": flash } : {})}
        onClick={open}
        className={cn(
          "group/row tree-flash relative grid w-full cursor-pointer overflow-clip grid-cols-[var(--icon)_minmax(0,1fr)_auto] items-center gap-x-(--space-2-5) gap-y-(--line-gap) rounded-md py-(--row-pad-y) pr-(--space-2) pl-(--tree-pad) text-ink-1 outline-none transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard focus-visible:focus-ring",
          selected ? "bg-brand-veil" : "hover:bg-veil-hover active:bg-veil-press",
          row.tone === "error" && selected
            ? "shadow-[inset_var(--error-rail)_0_0_var(--state-error),inset_0_0_0_var(--border)_var(--brand-ring)]"
            : row.tone === "error"
              ? "shadow-[inset_var(--error-rail)_0_0_var(--state-error)]"
              : selected && "shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]",
        )}
      >
        <span className="grid place-items-center">
          <Icon
            icon={TYPE_ICONS[row.itemKind]}
            tone={selected ? "active" : "current"}
            {...(selected ? {} : { className: "text-ink-4" })}
          />
        </span>
        <span ref={line1} className="relative col-span-2 flex min-w-0 items-center gap-(--space-1)">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-(length:--text-ui) leading-(--leading-ui)",
              row.waiting ? "font-(--weight-name-waiting)" : "font-(--weight-name)",
            )}
          >
            {row.name}
          </span>
          {isNext ? (
            <Kbd variant="jump" size="sm">
              Ctrl J
            </Kbd>
          ) : (
            showMeta && (
              <span
                data-meta=""
                className={cn(
                  MICRO,
                  "shrink-0 whitespace-nowrap tabular-nums",
                  selected
                    ? "text-ink-3"
                    : cn(FAINT, "hidden group-hover/row:inline group-focus-within/row:inline"),
                )}
              >
                {row.meta}
              </span>
            )
          )}
          <span
            ref={line1Measure}
            aria-hidden="true"
            className={cn(MEASURE, "flex gap-(--space-1)")}
          >
            <span
              className={cn(
                "text-(length:--text-ui)",
                row.waiting ? "font-(--weight-name-waiting)" : "font-(--weight-name)",
              )}
            >
              {row.name}
            </span>
            <span className={MICRO}>{row.meta}</span>
          </span>
        </span>

        <span className="grid place-items-center">
          <StateGlyph state={ROW_GLYPHS[row.tone]} />
        </span>
        <span
          ref={line2}
          className="relative flex min-w-0 items-center gap-(--space-1-5) text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
        >
          <span className="min-w-0 truncate">
            {row.reading ? (
              <Shimmer>{!narrow && longFits ? row.line2.long : row.line2.short}</Shimmer>
            ) : !narrow && longFits ? (
              row.line2.long
            ) : (
              row.line2.short
            )}
          </span>
          {row.more !== null && (
            <Tooltip content={row.more.tooltip}>
              <span
                className={cn(
                  MICRO,
                  "shrink-0 rounded-(--radius-pill) px-(--space-1) tabular-nums text-ink-3 shadow-[inset_0_0_0_var(--border)_var(--line-2)]",
                )}
              >
                +{row.more.count}
              </span>
            </Tooltip>
          )}
          <span
            ref={line2Measure}
            aria-hidden="true"
            className={cn(MEASURE, "flex gap-(--space-1-5)")}
          >
            <span>{row.line2.long}</span>
            {row.more !== null && (
              <span className={cn(MICRO, "px-(--space-1)")}>+{row.more.count}</span>
            )}
          </span>
        </span>
        <span className="flex items-center justify-self-end">
          {clock?.kind === "chip" && (
            <TimeChip
              tone={clock.tone}
              time={clock.time}
              longTime={clock.longTime}
              raised={selected && clock.tone === "close"}
            />
          )}
          {clock?.kind === "turn" && (
            <Tooltip content={clock.tooltip}>
              <span className={cn(MICRO, "whitespace-nowrap tabular-nums text-ink-3")}>
                {clock.time}
              </span>
            </Tooltip>
          )}
          {clock?.kind === "word" && (
            <span className={cn(MICRO, selected ? "text-ink-3" : FAINT)}>{clock.word}</span>
          )}
        </span>

        {work !== null && (
          <>
            <span />
            <span
              ref={line3}
              className={cn(
                MICRO,
                "relative min-w-0 truncate font-mono",
                selected ? "text-ink-3" : FAINT,
              )}
            >
              {/* The verb in the third ink, what it acts on in the row's. */}
              <span className="text-ink-3">{work.verb}</span>
              {(line3Fits ? work.long : work.short).slice(work.verb.length)}
              <span ref={line3Measure} aria-hidden="true" className={MEASURE}>
                {work.long}
              </span>
            </span>
            <span className="justify-self-end">
              <ContextMeter
                percent={work.contextPercent}
                compact={narrow}
                detail={`Context window ${Math.round(work.contextPercent)}% used`}
              />
            </span>
          </>
        )}
      </div>
    </Tooltip>
  );
}

// sameData is whether two plain values hold the same data, field by field.
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  const before = a as Record<string, unknown>;
  const after = b as Record<string, unknown>;
  const keys = Object.keys(before);
  return (
    keys.length === Object.keys(after).length &&
    keys.every((key) => Object.hasOwn(after, key) && sameData(before[key], after[key]))
  );
}

// sameShown is whether two rows show the same: every field of the row but the
// summary it came from, which is a new object on every state the app sends.
function sameShown(before: ItemRow, after: ItemRow): boolean {
  const { item: _before, ...shownBefore } = before;
  const { item: _after, ...shownAfter } = after;
  return sameData(shownBefore, shownAfter);
}

/**
 * TreeRow redraws only when what it shows changes: its texts, times, tone and
 * context, compared by value as each state brings new summaries, and its place
 * among the open, the next and the blinking rows.
 */
export const TreeRow = memo(
  TreeRowView,
  (before, after) =>
    sameShown(before.row, after.row) &&
    before.selected === after.selected &&
    before.isNext === after.isNext &&
    before.flash === after.flash &&
    before.narrow === after.narrow &&
    before.level === after.level &&
    before.tabIndex === after.tabIndex,
);
