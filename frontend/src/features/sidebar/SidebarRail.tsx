import { ChevronsRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/system/Icon";
import { IconButton } from "@/components/system/IconButton";
import { ITEM_ICONS, TONE_GLYPHS } from "@/components/system/item-parts";
import { ScrollArea } from "@/components/system/ScrollArea";
import { StateGlyph } from "@/components/system/StateGlyph";
import { TimeChip } from "@/components/system/TimeChip";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { NewMenu } from "@/features/sidebar/NewMenu";
import { SidebarFooter } from "@/features/sidebar/SidebarFooter";
import {
  flashOf,
  type ItemRow,
  nodeRows,
  type RowFlash,
  type RowTone,
  sidebarTree,
  type TreeEntry,
  type TreeNode,
} from "@/features/sidebar/sidebar-tree";
import { useTreeKeyboard } from "@/features/sidebar/useTreeKeyboard";
import { nextWaiting } from "@/lib/situations";
import { cn } from "@/lib/utils";
import { useAppStore, useFlashing, useOpenItemId, useRepositoryFilter } from "@/store/app-store";

/** RAIL_WORDS is what the foot of a block says without a clock: the state in one word. */
const RAIL_WORDS: Partial<Record<RowTone, string>> = {
  agent: "working",
  app: "working",
  github: "checks",
  paused: "paused",
  idle: "idle",
};

const MICRO = "text-(length:--text-micro) leading-(--leading-micro)";

/** RailGroup is the blocks of one node of the tree, with what its separator says. */
interface RailGroup {
  id: string;
  rows: ItemRow[];
  /** blocked is a failed reading or a missing clone in the node: the ◇ of its separator. */
  blocked: boolean;
  /** pending is how many pull requests wait for a review, on the separator of Reviews. */
  pending: number;
}

function groupOf(node: TreeNode): RailGroup {
  const blocked =
    node.kind === "reviews"
      ? node.failures.length > 0
      : node.notices.length > 0 || (node.kind === "board" && node.board.failure !== null);
  return {
    id: node.id,
    rows: nodeRows(node),
    blocked,
    pending: node.kind === "reviews" ? node.pending : 0,
  };
}

interface RailSeparatorProps {
  group: RailGroup;
}

/**
 * CENTERED puts a piece in the middle of the strip on whole pixels: a flex item centred in the 60px
 * strip lands on a half pixel whenever its width is odd, so the centring is rounded instead.
 */
const CENTERED =
  "absolute inset-y-0 left-[round(50%,1px)] flex translate-x-[round(-50%,1px)] items-center";

/** RailSeparator is the line between two groups, with the ◇ of a failure and the count of Reviews. */
function RailSeparator({ group }: RailSeparatorProps) {
  const says = group.blocked || group.pending > 0;
  return (
    <div role="none" data-rail-separator="" className="relative h-(--space-4)">
      {/* Centred in the separator's even height the line would fall on a half pixel, so it sits
          on the whole pixel just below the middle. */}
      <span className="absolute inset-x-(--space-2) top-(--space-2) h-(--border) bg-line-1" />
      {says && (
        // What the separator says breaks the line, on the sidebar's own tone.
        <span className={cn(CENTERED, "gap-(--space-1) bg-surface-sidebar px-(--space-1)")}>
          {group.blocked && <StateGlyph state="blocked" size="sm" />}
          {group.pending > 0 && (
            <span className={cn(MICRO, "tabular-nums text-ink-3")}>{group.pending}</span>
          )}
        </span>
      )}
    </div>
  );
}

interface RailBlockProps {
  row: ItemRow;
  selected: boolean;
  isNext: boolean;
  flash: RowFlash | null;
  tabIndex: 0 | -1;
}

/** RailBlock is an item on the collapsed strip: its type with the state in the corner, and its clock. */
function RailBlock({ row, selected, isNext, flash, tabIndex }: RailBlockProps) {
  const openTask = useAppStore((state) => state.openTask);
  const openReview = useAppStore((state) => state.openReview);
  const openDiscussion = useAppStore((state) => state.openDiscussion);
  const ref = useRef<HTMLDivElement>(null);

  // The open block comes into view, as the open row does.
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
  const { clock } = row;
  const word = clock === null || clock.kind === "word" ? RAIL_WORDS[row.tone] : undefined;

  return (
    <Tooltip content={row.name} sub={row.line2.long}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the strip owns the keyboard of its blocks */}
      <div
        ref={ref}
        role="treeitem"
        aria-label={row.label + (isNext ? " Ctrl+J opens this next." : "")}
        aria-selected={selected}
        {...(selected ? { "aria-current": "page" as const } : {})}
        tabIndex={tabIndex}
        data-entry-id={row.id}
        data-tone={row.tone}
        {...(flash !== null ? { "data-flash": flash } : {})}
        onClick={open}
        className={cn(
          // The gap under the type icon holds the corner of the state glyph with its outline, so
          // the glyph never reaches the clock.
          "group/block situation-flash relative flex w-full cursor-pointer flex-col items-center gap-(--space-1-5) rounded-md px-(--tree-pad) py-(--row-pad-y) outline-none transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard focus-visible:outline-(length:--focus-width) focus-visible:outline-focus focus-visible:-outline-offset-(length:--focus-width)",
          selected ? "bg-brand-veil" : "hover:bg-veil-hover active:bg-veil-press",
          row.tone === "error" && "error-rail-bar",
          selected && "shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]",
        )}
      >
        {/* The state glyph sits in the bottom right corner of the type icon's box. */}
        <span className="relative grid size-(--icon) place-items-center">
          <Icon
            icon={ITEM_ICONS[row.itemKind]}
            tone={selected ? "active" : "current"}
            {...(selected ? {} : { className: "text-ink-3" })}
          />
          <StateGlyph
            state={TONE_GLYPHS[row.tone]}
            size="sm"
            className="absolute -right-(--space-1) bottom-0 outline-(length:--border-2) outline-surface-sidebar"
          />
        </span>
        {row.more !== null && (
          <span
            className={cn(
              MICRO,
              "absolute top-(--space-1) right-(--space-1) tabular-nums text-ink-3",
            )}
          >
            +{row.more.count}
          </span>
        )}
        <span className="relative h-(--size-time-chip) w-full">
          <span className={CENTERED}>
            {clock?.kind === "chip" && (
              <TimeChip
                tone={clock.tone}
                time={clock.time}
                longTime={clock.longTime}
                raised={selected && clock.tone === "close"}
              />
            )}
            {clock?.kind === "turn" && (
              <span className={cn(MICRO, "whitespace-nowrap tabular-nums text-ink-3")}>
                {clock.time}
              </span>
            )}
            {word !== undefined && (
              <span
                className={cn(
                  MICRO,
                  // The fourth ink steps up on the open block and on the pressed one, whose veils it
                  // does not reach 4.5:1 over.
                  selected ? "text-ink-3" : "text-ink-4 group-active/block:text-ink-3",
                )}
              >
                {word}
              </span>
            )}
          </span>
        </span>
      </div>
    </Tooltip>
  );
}

/**
 * SidebarRail is the sidebar collapsed into its strip: » and New on top, a
 * block per item in the order of the tree, the collapsed nodes' items
 * included, and the foot in a column. The strip is a tree the keyboard walks
 * as one Tab stop.
 */
export function SidebarRail() {
  const app = useAppStore((state) => state.app);
  const filter = useRepositoryFilter();
  const flashing = useFlashing();
  const openItemId = useOpenItemId();
  const toggleSidebarRail = useAppStore((state) => state.toggleSidebarRail);
  const now = useNow(60_000, true);

  const groups = (app === null ? [] : sidebarTree(app, filter, now))
    .map(groupOf)
    .filter((group) => group.rows.length > 0 || group.blocked || group.pending > 0);
  const entries: TreeEntry[] = groups.flatMap((group) =>
    group.rows.map((row) => ({ kind: "item", id: row.id, level: 2, parentId: group.id, row })),
  );
  const nextId = nextWaiting(app, openItemId)?.itemId ?? null;
  const { tabIndexOf, onKeyDown, onFocus, onBlur } = useTreeKeyboard(entries, openItemId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col items-center gap-(--space-1) py-(--space-2)">
        <IconButton
          label="Expand the sidebar"
          icon={ChevronsRight}
          size="sm"
          onClick={() => toggleSidebarRail()}
        />
        <NewMenu rail />
      </div>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="relative">
        <div
          role="tree"
          aria-label="Active items"
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          className="flex flex-col gap-(--row-gap) pb-(--space-2)"
        >
          {groups.map((group) => (
            <div key={group.id} role="none" className="flex flex-col gap-(--row-gap)">
              <RailSeparator group={group} />
              {group.rows.map((row) => (
                <RailBlock
                  key={row.id}
                  row={row}
                  selected={row.id === openItemId}
                  isNext={row.id === nextId}
                  flash={row.id === openItemId ? null : flashOf([row], flashing)}
                  tabIndex={tabIndexOf(row.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
      <SidebarFooter rail />
    </div>
  );
}
