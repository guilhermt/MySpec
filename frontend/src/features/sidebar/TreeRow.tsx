import { memo, useEffect, useRef } from "react";
import { ContextMeter } from "@/components/system/ContextMeter";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Kbd } from "@/components/system/Kbd";
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

const TYPE_ICONS = {
  task: ICONS.task,
  "one-shot": ICONS.oneShot,
  review: ICONS.review,
  discussion: ICONS.discussion,
} as const satisfies Record<ItemKind, unknown>;

const GLYPHS: Record<RowTone, GlyphState> = {
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
// The invisible copy a cell measures its long content with.
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

  return (
    <Tooltip content={showMeta ? row.name : `${row.name} · ${row.meta}`}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the tree owns the keyboard of its rows */}
      <div
        ref={ref}
        role="treeitem"
        aria-level={level}
        aria-label={row.label + (isNext ? " Ctrl+J opens this next." : "")}
        aria-selected={selected}
        {...(selected ? { "aria-current": "page" as const } : {})}
        tabIndex={tabIndex}
        data-tone={row.tone}
        {...(flash !== null ? { "data-flash": flash } : {})}
        onClick={open}
        className={cn(
          "group/row tree-flash relative grid w-full cursor-pointer grid-cols-[var(--icon)_minmax(0,1fr)_auto] items-center gap-x-(--space-2-5) gap-y-(--line-gap) rounded-md py-(--row-pad-y) pr-(--space-2) text-ink-1 outline-none transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard focus-visible:focus-ring",
          // An item of an epic steps in along the epic's guide.
          level === 3 ? "pl-[calc(var(--tree-pad)+var(--epic-indent))]" : "pl-(--tree-pad)",
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
                    : "hidden text-ink-4 group-hover/row:inline group-focus-within/row:inline",
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
          <StateGlyph state={GLYPHS[row.tone]} />
        </span>
        <span
          ref={line2}
          className="relative flex min-w-0 items-center gap-(--space-1-5) text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
        >
          <span className="min-w-0 truncate">
            {!narrow && longFits ? row.line2.long : row.line2.short}
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
            <span className={cn(MICRO, selected ? "text-ink-3" : "text-ink-4")}>{clock.word}</span>
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
                selected ? "text-ink-3" : "text-ink-4",
              )}
            >
              {line3Fits ? work.long : work.short}
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

/**
 * TreeRow redraws only when what it shows changes: the summary it came from
 * (by reference, as the state replaces what changed), its name, and its place
 * among the open, the next and the blinking rows.
 */
export const TreeRow = memo(
  TreeRowView,
  (before, after) =>
    before.row.item === after.row.item &&
    before.row.label === after.row.label &&
    before.selected === after.selected &&
    before.isNext === after.isNext &&
    before.flash === after.flash &&
    before.narrow === after.narrow &&
    before.level === after.level &&
    before.tabIndex === after.tabIndex,
);
