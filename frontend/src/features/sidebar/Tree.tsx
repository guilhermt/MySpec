import { Fragment, type ReactNode } from "react";
import { useNow } from "@/features/attention/useNow";
import { CloneNotice } from "@/features/sidebar/CloneNotice";
import {
  type EpicNode,
  emptyTreeText,
  flashOf,
  type ItemRow,
  nodeRows,
  nodeSummary,
  sidebarTree,
  type TreeNode,
  visibleEntries,
} from "@/features/sidebar/sidebar-tree";
import { TreeNodeRow } from "@/features/sidebar/TreeNodeRow";
import { TreeRow } from "@/features/sidebar/TreeRow";
import { useNarrow } from "@/features/sidebar/useFits";
import { useTreeKeyboard } from "@/features/sidebar/useTreeKeyboard";
import { nextWaiting } from "@/lib/situations";
import {
  useAppStore,
  useFlashing,
  useOpenBoardId,
  useOpenItemId,
  useRepositoryFilter,
  useReviewsOpen,
  useSidebarCollapsed,
} from "@/store/app-store";

const groupIdOf = (nodeId: string) => `${nodeId}:group`;

// An empty node or tree says so in the column of the rows' text.
const EMPTY =
  "py-(--space-1) pr-(--space-2) pl-[calc(var(--tree-pad)+var(--icon)+var(--space-2-5))] text-(length:--text-meta) leading-(--leading-meta) text-ink-3";

/**
 * Tree is the active items in their nodes: Reviews, a node per board with its
 * clone notices and its epics, then No board. The item on screen shows open,
 * the one Ctrl+J opens next carries the mark, and a situation that just started
 * blinks its row, or the summary of the collapsed node holding it. The
 * keyboard walks it as one Tab stop. A narrow sidebar, told by
 * SidebarWidthContext, gives its rows their short forms.
 */
export function Tree() {
  const narrow = useNarrow();
  const app = useAppStore((state) => state.app);
  const filter = useRepositoryFilter();
  const collapsed = useSidebarCollapsed();
  const flashing = useFlashing();
  const openItemId = useOpenItemId();
  const openBoardId = useOpenBoardId();
  const reviewsOpen = useReviewsOpen();
  const now = useNow(60_000, true);

  const nodes = app === null ? [] : sidebarTree(app, filter, now);
  const nextId = nextWaiting(app, openItemId)?.itemId ?? null;
  const empty = app === null ? null : emptyTreeText(app, filter);
  const { tabIndexOf, onKeyDown, onFocus, onBlur } = useTreeKeyboard(
    visibleEntries(nodes, collapsed),
    openItemId,
  );

  if (app === null) {
    return null;
  }

  const itemRow = (row: ItemRow, level: 2 | 3) => (
    <TreeRow
      key={row.id}
      row={row}
      level={level}
      selected={row.id === openItemId}
      isNext={row.id === nextId}
      flash={row.id === openItemId ? null : flashOf([row], flashing)}
      narrow={narrow}
      tabIndex={tabIndexOf(row.id)}
    />
  );

  const node = (
    item: TreeNode | EpicNode,
    level: 1 | 2,
    children: ReactNode,
    className?: string,
  ) => {
    const expanded = !collapsed.has(item.id);
    const under = nodeRows(item);
    return (
      <Fragment key={item.id}>
        <TreeNodeRow
          node={item}
          level={level}
          expanded={expanded}
          current={
            (item.kind === "board" && item.board.id === openBoardId) ||
            (item.kind === "reviews" && reviewsOpen)
          }
          summary={expanded ? null : nodeSummary(under)}
          flash={
            expanded
              ? null
              : flashOf(
                  under.filter((row) => row.id !== openItemId),
                  flashing,
                )
          }
          groupId={groupIdOf(item.id)}
          tabIndex={tabIndexOf(item.id)}
        />
        {expanded && (
          // biome-ignore lint/a11y/useSemanticElements: a fieldset is a form grouping, not a tree group
          <div role="group" id={groupIdOf(item.id)} className={className}>
            {children}
          </div>
        )}
      </Fragment>
    );
  };

  return (
    <div
      role="tree"
      aria-label="Active items"
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      // The top nodes stand apart as sections: Reviews, each board, No board.
      className="flex flex-col gap-(--section-gap) p-(--space-2)"
    >
      {nodes.map((top) => {
        const epics = top.kind === "board" ? top.epics : [];
        const notices = top.kind === "reviews" ? [] : top.notices;
        const nothing = notices.length === 0 && epics.length === 0 && top.rows.length === 0;
        return (
          // A section is its node and, right under it, the group, which keeps its own step down.
          <div key={top.id} role="none" className="flex flex-col">
            {node(
              top,
              1,
              <>
                {notices.map((notice) => (
                  <CloneNotice key={notice.id} notice={notice} tabIndex={tabIndexOf(notice.id)} />
                ))}
                {epics.map((epic) =>
                  node(
                    epic,
                    2,
                    epic.rows.map((row) => itemRow(row, 3)),
                    // The epic's items step in as boxes, so the open row, the hover and the error rail
                    // start after the guide, which runs down under the epic's chevron.
                    "relative ml-(--epic-indent) flex flex-col gap-(--row-gap) pt-(--row-gap) before:absolute before:top-0 before:bottom-(--space-1) before:left-[calc(var(--guide-x)-var(--epic-indent))] before:w-(--border) before:bg-sidebar-guide",
                  ),
                )}
                {top.rows.map((row) => itemRow(row, 2))}
                {nothing && top.kind !== "no-board" && (
                  <div role="none" className={EMPTY}>
                    {top.kind === "reviews" ? "No review in progress." : "No active items."}
                  </div>
                )}
              </>,
              "flex flex-col gap-(--row-gap) pt-(--space-1)",
            )}
          </div>
        );
      })}
      {empty !== null && (
        <div role="none" className={EMPTY}>
          {empty}
        </div>
      )}
    </div>
  );
}
