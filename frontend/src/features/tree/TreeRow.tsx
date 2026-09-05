import { ChevronRight, FolderGit2, House } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TreeRowModel } from "@/features/tree/tree-model";
import { cn } from "@/lib/utils";
import type { NodeId } from "@/store/app-store";

const INDENT: Record<1 | 2 | 3, string> = { 1: "pl-2", 2: "pl-5", 3: "pl-8" };

export interface TreeRowProps {
  row: TreeRowModel;
  onSelect: (id: NodeId) => void;
  onToggle: (id: NodeId) => void;
}

export function TreeRow({ row, onSelect, onToggle }: TreeRowProps) {
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
      className={cn(
        "flex h-[var(--row-height)] cursor-default items-center gap-1 rounded-md pr-2 outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        INDENT[row.level],
        row.selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      )}
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
    </div>
  );
}
