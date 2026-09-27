import { Fragment, type ReactNode, useEffect } from "react";
import { useNow } from "@/features/attention/useNow";
import {
  type EpicNode,
  flashOf,
  type ItemRow,
  nodeRows,
  nodeSummary,
  nodesOfItem,
  sidebarTree,
  type TreeNode,
} from "@/features/sidebar/sidebar-tree";
import { TreeNodeRow } from "@/features/sidebar/TreeNodeRow";
import { TreeRow } from "@/features/sidebar/TreeRow";
import { nextWaiting } from "@/lib/situations";
import {
  useAppStore,
  useFlashing,
  useOpenBoardId,
  useOpenItemId,
  useRepositoryFilter,
  useSidebarCollapsed,
} from "@/store/app-store";

export interface TreeProps {
  /** narrow is a sidebar under 330px, whose rows take their short forms. */
  narrow: boolean;
}

const groupIdOf = (nodeId: string) => `${nodeId}:group`;

const EMPTY =
  "px-(--tree-pad) py-(--row-pad-y) text-(length:--text-meta) leading-(--leading-meta) text-ink-3";

/**
 * Tree is the active items in their nodes: a node per board, with its epics,
 * then No board. The item on screen shows open, the one Ctrl+J opens next
 * carries the mark, and a situation that just started blinks its row, or the
 * summary of the collapsed node holding it.
 */
export function Tree({ narrow }: TreeProps) {
  const app = useAppStore((state) => state.app);
  const expandSidebarNodes = useAppStore((state) => state.expandSidebarNodes);
  const filter = useRepositoryFilter();
  const collapsed = useSidebarCollapsed();
  const flashing = useFlashing();
  const openItemId = useOpenItemId();
  const openBoardId = useOpenBoardId();
  const now = useNow(60_000, true);

  // Reviews and the clone notices keep their own pieces above the tree.
  const nodes =
    app === null ? [] : sidebarTree(app, filter, now).filter((node) => node.kind !== "reviews");
  const nextId = nextWaiting(app, openItemId)?.itemId ?? null;

  // An item that opens shows in the tree, with its nodes expanded: when it
  // opens, or when it joins the state after opening. Collapsing a node changes
  // neither.
  const openNodes = openItemId === null ? [] : nodesOfItem(nodes, openItemId);
  const openNodesKey = openNodes.join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: openNodesKey stands for openNodes
  useEffect(() => {
    expandSidebarNodes(openNodes);
  }, [openItemId, openNodesKey, expandSidebarNodes]);

  if (nodes.length === 0) {
    return null;
  }

  // One Tab stop: the open row, or the first line of the tree.
  const rows = nodes.flatMap(nodeRows);
  const tabStop = rows.some((row) => row.id === openItemId) ? openItemId : nodes[0]?.id;
  const tabIndexOf = (id: string) => (id === tabStop ? 0 : -1);

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
          current={item.kind === "board" && item.board.id === openBoardId}
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
      className="flex flex-col gap-(--row-gap) p-(--space-2)"
    >
      {nodes.map((top) => {
        const epics = top.kind === "board" ? top.epics : [];
        const empty = epics.length === 0 && top.rows.length === 0;
        return node(
          top,
          1,
          <>
            {epics.map((epic) =>
              node(
                epic,
                2,
                epic.rows.map((row) => itemRow(row, 3)),
                // The guide runs down under the epic's chevron.
                "relative flex flex-col gap-(--row-gap) pt-(--row-gap) before:absolute before:top-0 before:bottom-(--space-1) before:left-(--guide-x) before:w-(--border) before:bg-sidebar-guide",
              ),
            )}
            {top.rows.map((row) => itemRow(row, 2))}
            {empty && top.kind === "board" && (
              <div role="none" className={EMPTY}>
                No active items.
              </div>
            )}
          </>,
          "flex flex-col gap-(--row-gap) pt-(--space-1)",
        );
      })}
    </div>
  );
}
