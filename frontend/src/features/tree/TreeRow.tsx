import { ChevronRight, FolderGit2, House } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/features/task/StatusDot";
import { taskStatusLabel } from "@/features/task/status";
import type { TreeRowModel } from "@/features/tree/tree-model";
import { type SituationTone, situationTone } from "@/lib/situations";
import { cn } from "@/lib/utils";
import type { Situation } from "@/lib/wails";
import type { NodeId } from "@/store/app-store";

const INDENT: Record<1 | 2 | 3, string> = { 1: "pl-2", 2: "pl-5", 3: "pl-8" };

const ROW_CLASS =
  "flex h-[var(--row-height)] cursor-default items-center gap-1 rounded-md pr-2 outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

function selectionClass(selected: boolean): string {
  return selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50";
}

// Written out so Tailwind sees every class; the tone is chosen at runtime. The
// dark theme lightens the destructive red, where white text would lose its
// contrast, so the number turns dark there as it does on the attention tone.
const COUNT_TONE: Record<SituationTone, string> = {
  error: "bg-destructive text-white dark:text-black",
  attention: "bg-[var(--status-attention)] text-black",
};

interface HiddenCountProps {
  situations: readonly Situation[];
  flashing: boolean;
}

/**
 * HiddenCount tells how many situations a collapsed node hides, in the tone of
 * the most urgent one. The number alone would read as nothing, so a screen
 * reader hears what it counts.
 */
function HiddenCount({ situations, flashing }: HiddenCountProps) {
  const [first] = situations;
  if (first === undefined) {
    return null;
  }
  const tone = situationTone(first);
  return (
    <span
      data-tone={tone}
      className={cn(
        "ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[11px] leading-none font-semibold tabular-nums",
        COUNT_TONE[tone],
        flashing && "attention-flash-ring",
      )}
    >
      <span aria-hidden="true">{situations.length}</span>
      <span className="sr-only">{`${situations.length} waiting for you`}</span>
    </span>
  );
}

export interface TreeRowProps {
  row: TreeRowModel;
  onSelect: (id: NodeId) => void;
  onToggle: (id: NodeId) => void;
  onOpenTask: (id: string) => void;
}

export function TreeRow({ row, onSelect, onToggle, onOpenTask }: TreeRowProps) {
  if (row.kind === "empty-tasks") {
    return (
      <div
        role="none"
        className={cn(
          "flex h-[var(--row-height)] items-center text-xs italic text-muted-foreground",
          INDENT[row.level],
        )}
      >
        No tasks yet
      </div>
    );
  }

  if (row.kind === "empty-repos") {
    return (
      <div role="none" className={cn("py-1 pr-2 text-xs text-muted-foreground", INDENT[row.level])}>
        No repositories found among the direct children of this folder.
      </div>
    );
  }

  if (row.kind === "task") {
    // The highlight takes the tone the dot of the row shows: that of the most
    // urgent situation of the task.
    const [urgent] = row.task.situations ?? [];
    const flashTone = row.flashing && urgent !== undefined ? situationTone(urgent) : undefined;
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: the tree owns the keyboard for every row
      <div
        role="treeitem"
        aria-level={row.level}
        aria-selected={row.selected}
        tabIndex={row.selected ? 0 : -1}
        onClick={() => onOpenTask(row.task.id)}
        data-tone={flashTone}
        className={cn(
          ROW_CLASS,
          INDENT[row.level],
          selectionClass(row.selected),
          row.flashing && "attention-flash",
        )}
      >
        {/* A leaf has no chevron; the spacer keeps it aligned with the nodes. */}
        <span aria-hidden="true" className="size-4 shrink-0" />
        <StatusDot task={row.task} className="mx-0.5" />
        <span className="min-w-0 flex-1 truncate">{row.task.name}</span>
        {/* The space keeps the accessible name of the row readable. */}{" "}
        <span className={cn("shrink-0 text-xs", !row.selected && "text-muted-foreground")}>
          {taskStatusLabel(row.task)}
        </span>
      </div>
    );
  }

  const Icon = row.isRoot ? House : FolderGit2;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the tree owns the keyboard for every row
    <div
      role="treeitem"
      aria-level={row.level}
      aria-expanded={row.expanded}
      aria-selected={row.selected}
      tabIndex={row.selected ? 0 : -1}
      onClick={() => onSelect(row.id)}
      className={cn(ROW_CLASS, INDENT[row.level], selectionClass(row.selected))}
    >
      <span
        aria-hidden="true"
        data-testid="chevron"
        onClick={(event) => {
          event.stopPropagation();
          onToggle(row.id);
        }}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm hover:text-foreground",
          !row.selected && "text-muted-foreground",
        )}
      >
        <ChevronRight
          className={cn(
            "size-3.5 transition-transform duration-[var(--duration-base)] ease-[var(--ease-standard)]",
            row.expanded && "rotate-90",
          )}
        />
      </span>
      <Icon
        aria-hidden="true"
        className={cn("size-3.5 shrink-0", !row.selected && "text-muted-foreground")}
      />
      <span className="min-w-0 truncate">{row.label}</span>
      {row.isRoot && (
        <>
          {/* The space keeps the accessible name of the row readable. */}{" "}
          <Badge variant="secondary" className="shrink-0">
            Root
          </Badge>
        </>
      )}
      {row.hidden.length > 0 && (
        <>
          {/* The space keeps the accessible name of the row readable. */}{" "}
          <HiddenCount situations={row.hidden} flashing={row.flashing} />
        </>
      )}
    </div>
  );
}
