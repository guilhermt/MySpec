import { Icon } from "@/components/system/Icon";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { Shimmer } from "@/components/system/Shimmer";
import { type GlyphState, StateGlyph } from "@/components/system/StateGlyph";
import { Tooltip } from "@/components/system/Tooltip";
import {
  type EpicNode,
  type NodeSummary,
  nodeStatus,
  type RowFlash,
  type RowTone,
  type TreeNode,
} from "@/features/sidebar/sidebar-tree";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

export interface TreeNodeRowProps {
  node: TreeNode | EpicNode;
  level: 1 | 2;
  expanded: boolean;
  /** current is the node of the place on screen: its board, Reviews or Deploys. */
  current: boolean;
  /** summary is what the node says of its rows while collapsed; null when nothing counts. */
  summary: NodeSummary | null;
  flash: RowFlash | null;
  /** groupId is the id of the group holding the node's children. */
  groupId: string;
  tabIndex: 0 | -1;
}

const SUMMARY_GLYPHS: Record<NodeSummary["parts"][number]["tone"], GlyphState> = {
  error: "error",
  wait: "wait",
  close: "close",
  agent: "work",
  app: "work",
  github: "github",
  paused: "paused",
} satisfies Partial<Record<RowTone, GlyphState>>;

const MICRO = "text-(length:--text-micro) leading-(--leading-micro)";

// The count steps up to the third ink on the open place and on the pressed node.
const COUNT = cn(
  MICRO,
  "font-normal tabular-nums text-ink-4 group-active/node:text-ink-3 group-aria-[current=page]/node:text-ink-3",
);

function titleOf(node: TreeNode | EpicNode): string {
  switch (node.kind) {
    case "reviews":
      return "Reviews";
    case "deploys":
      return "Deploys";
    case "board":
      return node.board.title;
    case "no-board":
      return "No board";
    case "epic":
      return node.title;
  }
}

interface NodeStatusProps {
  node: TreeNode | EpicNode;
}

/** NodeStatus is what an expanded node says at its right edge: pending, reading or a failed reading. */
function NodeStatus({ node }: NodeStatusProps) {
  if (node.kind === "reviews") {
    if (node.failures.length > 0) {
      return <ReadFailed detail={node.failures.join(", ")} />;
    }
    if (node.reading) {
      return <Shimmer className={cn(MICRO, "font-normal")}>reading…</Shimmer>;
    }
    if (node.pending > 0) {
      return <span className={COUNT}>{node.pending} pending</span>;
    }
    return null;
  }
  if (node.kind === "deploys") {
    if (node.failure !== null) {
      return <ReadFailed detail={node.failure} />;
    }
    if (node.reading) {
      return <Shimmer className={cn(MICRO, "font-normal")}>reading…</Shimmer>;
    }
    if (!node.failed && node.waiting === 0) {
      return null;
    }
    return (
      <span className="inline-flex items-center gap-(--space-1-5)">
        {node.failed && <StateGlyph state="error" />}
        {node.waiting > 0 && <span className={COUNT}>{node.waiting} to deploy</span>}
      </span>
    );
  }
  if (node.kind === "board") {
    if (node.board.failure !== null) {
      return <ReadFailed detail={node.board.failure.message} />;
    }
    if (node.board.reading) {
      return <Shimmer className={cn(MICRO, "font-normal")}>reading…</Shimmer>;
    }
  }
  return null;
}

interface ReadFailedProps {
  detail: string;
}

/** ReadFailed is a reading of the node that failed, with what failed in the tooltip. */
function ReadFailed({ detail }: ReadFailedProps) {
  return (
    <Tooltip content={detail}>
      <span
        className={cn(MICRO, "inline-flex items-center gap-(--space-1) font-normal text-ink-3")}
      >
        <StateGlyph state="blocked" />
        Read failed
      </span>
    </Tooltip>
  );
}

/**
 * TreeNodeRow is a node of the tree: Reviews, Deploys, a board, an epic or No board.
 * Its chevron collapses it; its title opens the place of a board, of Reviews or of Deploys
 * and collapses the others. Deploys has no children, so it has no chevron.
 */
export function TreeNodeRow({
  node,
  level,
  expanded,
  current,
  summary,
  flash,
  groupId,
  tabIndex,
}: TreeNodeRowProps) {
  const toggleSidebarNode = useAppStore((state) => state.toggleSidebarNode);
  const openBoard = useAppStore((state) => state.openBoard);
  const openReviews = useAppStore((state) => state.openReviews);
  const openDeploys = useAppStore((state) => state.openDeploys);
  const title = titleOf(node);
  const place = node.kind === "board" || node.kind === "reviews" || node.kind === "deploys";
  const leaf = node.kind === "deploys";
  // A collapsed node tells what its rows say; otherwise the node tells its own state, which its
  // name says too, since the name takes the place of what the node shows.
  const shown = expanded ? null : summary;
  const told = shown !== null ? shown.label : nodeStatus(node);

  const onTitle = () => {
    if (node.kind === "board") {
      openBoard(node.board.id);
    } else if (node.kind === "reviews") {
      openReviews();
    } else if (node.kind === "deploys") {
      openDeploys();
    } else {
      toggleSidebarNode(node.id);
    }
  };

  return (
    <div
      role="treeitem"
      aria-level={level}
      {...(leaf ? {} : { "aria-expanded": expanded, "aria-owns": groupId })}
      aria-label={told !== null ? `${title}, ${told}` : title}
      {...(current ? { "aria-current": "page" as const } : {})}
      tabIndex={tabIndex}
      data-entry-id={node.id}
      className={cn(
        "group/node grid h-(--size-node) w-full grid-cols-[var(--icon)_minmax(0,1fr)_auto] items-center gap-x-(--space-2-5) rounded-sm pr-(--space-2) pl-(--tree-pad) outline-none transition-colors duration-(--duration-fast) ease-standard focus-visible:focus-ring",
        node.kind === "epic"
          ? "text-(length:--text-meta) leading-(--leading-meta) font-medium text-ink-3"
          : "text-(length:--text-ui) leading-(--leading-ui) font-medium text-ink-2",
        current
          ? "bg-brand-veil shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]"
          : "hover:bg-veil-hover hover:text-ink-1 active:bg-veil-press",
      )}
    >
      {leaf ? (
        <span aria-hidden="true" />
      ) : (
        <IconButton
          label={expanded ? "Collapse" : "Expand"}
          icon={expanded ? ICONS.expanded : ICONS.chevron}
          size="xs"
          tabIndex={-1}
          onClick={() => toggleSidebarNode(node.id)}
          className="justify-self-center text-ink-4"
        />
      )}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the tree owns the keyboard of its nodes */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the title is a pointer shortcut of the node, which is the treeitem */}
      <span
        data-node-title=""
        onClick={onTitle}
        className="inline-flex min-w-0 cursor-pointer items-center gap-(--space-1-5)"
      >
        <span className="truncate">{title}</span>
        {place && (
          <Icon
            icon={ICONS.go}
            size="sm"
            className="text-ink-3 opacity-0 transition-opacity duration-(--duration-fast) group-hover/node:opacity-100 group-focus-visible/node:opacity-100"
          />
        )}
      </span>
      {shown !== null ? (
        <span
          role="img"
          aria-label={shown.label}
          {...(flash !== null ? { "data-flash": flash } : {})}
          className={cn(
            MICRO,
            "situation-flash inline-flex items-center gap-(--space-1-5) rounded-sm font-medium tabular-nums text-ink-3",
          )}
        >
          {shown.parts.map((part, index) => (
            <span key={part.tone} className="inline-flex items-center gap-(--space-1)">
              <StateGlyph state={SUMMARY_GLYPHS[part.tone]} size="sm" />
              {index === 0 ? `${part.count} ${shown.word}` : part.count}
            </span>
          ))}
        </span>
      ) : (
        <NodeStatus node={node} />
      )}
    </div>
  );
}
