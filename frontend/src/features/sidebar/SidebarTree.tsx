import { ChevronRight, TriangleAlert } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { discussionRowLabel, discussionStatusTone } from "@/features/discussion/discussion-status";
import {
  type DiscussionRow,
  type EpicNode,
  nodesOfItem,
  rowId,
  type SidebarNode,
  sidebarTree,
  visibleRows,
} from "@/features/sidebar/legacy-sidebar-tree";
import { emptyTasksText, type TaskRow } from "@/features/sidebar/task-list";
import { useTaskListKeyboard } from "@/features/sidebar/useTaskListKeyboard";
import { StatusDot, ToneDot } from "@/features/task/StatusDot";
import { taskStatusLabel } from "@/features/task/status";
import { situationTone } from "@/lib/situations";
import { cn } from "@/lib/utils";
import {
  useAppStore,
  useFlashing,
  useOpenBoardId,
  useOpenDiscussionId,
  useOpenTaskId,
  useRepositoryFilter,
  useSidebarCollapsed,
} from "@/store/app-store";

const ROW_CLASS =
  "flex h-12 cursor-default flex-col justify-center gap-0.5 rounded-md px-2 outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

const HEADER_BUTTON_CLASS =
  "flex h-7 items-center rounded-md outline-none transition-colors duration-[var(--duration-fast)] hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

interface TaskRowItemProps {
  row: TaskRow;
  focusable: boolean;
}

/** TaskRowItem is one task of the tree, opening it on click. */
function TaskRowItem({ row, focusable }: TaskRowItemProps) {
  const openTask = useAppStore((state) => state.openTask);
  // The highlight takes the tone of the most urgent situation of the task.
  const [urgent] = row.task.situations ?? [];
  const flashTone = row.flashing && urgent !== undefined ? situationTone(urgent) : undefined;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the tree owns the keyboard for every row
    <div
      role="treeitem"
      data-task-row=""
      aria-selected={row.selected}
      aria-label={`${row.task.name}, ${row.fullName}, ${taskStatusLabel(row.task)}`}
      tabIndex={focusable ? 0 : -1}
      onClick={() => openTask(row.task.id)}
      data-tone={flashTone}
      className={cn(
        ROW_CLASS,
        row.selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
        row.flashing && "attention-flash",
      )}
    >
      <span className="flex items-center gap-1">
        <StatusDot task={row.task} className="mx-0.5" />
        <span className="min-w-0 flex-1 truncate">{row.task.name}</span>
        <span className={cn("shrink-0 text-xs", !row.selected && "text-muted-foreground")}>
          {taskStatusLabel(row.task)}
        </span>
      </span>
      <span className="truncate pl-4 text-xs text-muted-foreground" title={row.fullName}>
        {row.cardNumber !== null && `#${row.cardNumber} `}
        {row.shortName}
      </span>
    </div>
  );
}

interface DiscussionRowItemProps {
  row: DiscussionRow;
  focusable: boolean;
}

/** DiscussionRowItem is one discussion of the tree, opening it on click. */
function DiscussionRowItem({ row, focusable }: DiscussionRowItemProps) {
  const openDiscussion = useAppStore((state) => state.openDiscussion);
  const { discussion } = row;
  // The dot and the highlight take the tone of the most urgent situation.
  const [urgent] = discussion.situations ?? [];
  const tone = urgent !== undefined ? situationTone(urgent) : discussionStatusTone(discussion);
  const label = discussionRowLabel(discussion);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the tree owns the keyboard for every row
    <div
      role="treeitem"
      data-task-row=""
      aria-selected={row.selected}
      aria-label={`${discussion.title}, discussion, ${label}`}
      tabIndex={focusable ? 0 : -1}
      onClick={() => openDiscussion(discussion.id)}
      data-tone={row.flashing ? tone : undefined}
      className={cn(
        ROW_CLASS,
        row.selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
        row.flashing && "attention-flash",
      )}
    >
      <span className="flex items-center gap-1">
        <ToneDot tone={tone} className="mx-0.5" />
        <span className="min-w-0 flex-1 truncate">{discussion.title}</span>
        <span className={cn("shrink-0 text-xs", !row.selected && "text-muted-foreground")}>
          {label}
        </span>
      </span>
      <span className="truncate pl-4 text-xs text-muted-foreground">Discussion</span>
    </div>
  );
}

interface TreeNodeProps {
  id: string;
  /** title is the name the chevron reads: "Collapse <title>". */
  title: string;
  /** header is what follows the chevron. */
  header: ReactNode;
  children: ReactNode;
}

/** TreeNode is a node of the tree with a chevron that collapses its children. */
function TreeNode({ id, title, header, children }: TreeNodeProps) {
  const collapsed = useSidebarCollapsed().has(id);
  const toggleSidebarNode = useAppStore((state) => state.toggleSidebarNode);

  return (
    <div
      role="treeitem"
      aria-expanded={!collapsed}
      aria-label={title}
      // The chevron and the title take the focus of a node; the node itself only by script.
      tabIndex={-1}
      className="flex flex-col"
    >
      <div className="flex min-w-0 items-center gap-0.5">
        <button
          type="button"
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`}
          onClick={() => toggleSidebarNode(id)}
          className={cn(HEADER_BUTTON_CLASS, "w-6 shrink-0 justify-center text-muted-foreground")}
        >
          <ChevronRight
            aria-hidden="true"
            className={cn("size-3.5 transition-transform", !collapsed && "rotate-90")}
          />
        </button>
        {header}
      </div>
      {!collapsed && children}
    </div>
  );
}

interface GroupProps {
  className?: string;
  children: ReactNode;
}

/** Group holds the children of a node of the tree. */
function Group({ className, children }: GroupProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is a form grouping, not a tree group
    <div role="group" className={cn("flex flex-col", className)}>
      {children}
    </div>
  );
}

interface RowsProps {
  rows: readonly TaskRow[];
  focusableId: string | undefined;
}

/** Rows is the task rows of a node. */
function Rows({ rows, focusableId }: RowsProps) {
  return rows.map((row) => (
    <TaskRowItem key={row.task.id} row={row} focusable={row.task.id === focusableId} />
  ));
}

interface DiscussionRowsProps {
  rows: readonly DiscussionRow[];
  focusableId: string | undefined;
}

/** DiscussionRows is the discussion rows of a node, after its tasks. */
function DiscussionRows({ rows, focusableId }: DiscussionRowsProps) {
  return rows.map((row) => (
    <DiscussionRowItem
      key={row.discussion.id}
      row={row}
      focusable={row.discussion.id === focusableId}
    />
  ));
}

interface EpicProps {
  epic: EpicNode;
  focusableId: string | undefined;
}

/** Epic is the tasks of a board whose cards share an epic. */
function Epic({ epic, focusableId }: EpicProps) {
  const toggleSidebarNode = useAppStore((state) => state.toggleSidebarNode);

  return (
    <TreeNode
      id={epic.id}
      title={epic.title}
      header={
        <button
          type="button"
          onClick={() => toggleSidebarNode(epic.id)}
          className={cn(HEADER_BUTTON_CLASS, "min-w-0 flex-1 px-1 text-xs text-muted-foreground")}
        >
          <span className="truncate">{epic.title}</span>
        </button>
      }
    >
      <Group className="pl-3">
        <Rows rows={epic.tasks} focusableId={focusableId} />
      </Group>
    </TreeNode>
  );
}

interface NodeProps {
  node: SidebarNode;
  focusableId: string | undefined;
}

/** Node is a board of the tree, or the items of no board. */
function Node({ node, focusableId }: NodeProps) {
  const openBoard = useAppStore((state) => state.openBoard);
  const openBoardId = useOpenBoardId();

  if (node.kind === "no-board") {
    return (
      <TreeNode
        id={node.id}
        title="No board"
        header={<span className="px-1 text-xs font-medium text-muted-foreground">No board</span>}
      >
        <Group>
          <Rows rows={node.tasks} focusableId={focusableId} />
          <DiscussionRows rows={node.discussions} focusableId={focusableId} />
        </Group>
      </TreeNode>
    );
  }

  const { board } = node;
  return (
    <TreeNode
      id={node.id}
      title={board.title}
      header={
        <>
          <button
            type="button"
            aria-current={openBoardId === board.id ? "page" : undefined}
            onClick={() => openBoard(board.id)}
            className={cn(
              HEADER_BUTTON_CLASS,
              "min-w-0 flex-1 px-1 text-xs font-medium",
              openBoardId === board.id && "bg-accent text-accent-foreground hover:bg-accent",
            )}
          >
            <span className="truncate">{board.title}</span>
          </button>
          {board.failure !== null && (
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                className="flex shrink-0 items-center px-1 text-[var(--status-attention)]"
              >
                <TriangleAlert aria-hidden="true" className="size-3.5" />
                <span className="sr-only">Reading failed</span>
              </TooltipTrigger>
              <TooltipContent>{board.failure.message}</TooltipContent>
            </Tooltip>
          )}
        </>
      }
    >
      <Group>
        {node.epics.map((epic) => (
          <Epic key={epic.id} epic={epic} focusableId={focusableId} />
        ))}
        <Rows rows={node.tasks} focusableId={focusableId} />
        <DiscussionRows rows={node.discussions} focusableId={focusableId} />
      </Group>
    </TreeNode>
  );
}

/**
 * SidebarTree is the active items of the filter grouped by board and epic, in
 * the order they were created, with the discussions of a node after its tasks.
 */
export function SidebarTree() {
  const app = useAppStore((state) => state.app);
  const openTaskId = useOpenTaskId();
  const openDiscussionId = useOpenDiscussionId();
  const expandSidebarNodes = useAppStore((state) => state.expandSidebarNodes);
  const collapsed = useSidebarCollapsed();
  const flashing = useFlashing();
  const filter = useRepositoryFilter();
  const treeRef = useRef<HTMLDivElement>(null);

  // The tree opens one item at a time: the open task, or the open discussion.
  const openItemId = openTaskId ?? openDiscussionId;
  const nodes = app === null ? [] : sidebarTree(app, filter, openItemId, flashing);
  const rows = visibleRows(nodes, collapsed);
  // The selected row takes the focus in; with none selected the first one does.
  const selectedRow = rows.find((row) => row.selected) ?? rows[0];
  const focusableId = selectedRow === undefined ? undefined : rowId(selectedRow);

  const focusRowAt = useCallback((index: number) => {
    treeRef.current?.querySelectorAll<HTMLElement>("[data-task-row]").item(index)?.focus();
  }, []);

  const onRowsKeyDown = useTaskListKeyboard(rows, focusRowAt);

  // An item that opens shows in the tree, with its nodes expanded: when it
  // opens, or when it joins the state after opening. Collapsing a node changes
  // neither.
  const openNodes = openItemId === null ? [] : nodesOfItem(nodes, openItemId);
  const openNodesKey = openNodes.join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: openNodesKey stands for openNodes
  useEffect(() => {
    expandSidebarNodes(openNodes);
  }, [openItemId, openNodesKey, expandSidebarNodes]);

  if (app === null) {
    return null;
  }

  if (nodes.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">{emptyTasksText(app, filter)}</p>;
  }

  // The headers keep their own keys: only the rows move along the tree.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement && event.target.dataset.taskRow !== undefined) {
      onRowsKeyDown(event);
    }
  };

  return (
    <div
      role="tree"
      aria-label="Tasks"
      ref={treeRef}
      onKeyDown={onKeyDown}
      className="flex flex-col p-1"
    >
      {nodes.map((node) => (
        <Node key={node.id} node={node} focusableId={focusableId} />
      ))}
    </div>
  );
}
