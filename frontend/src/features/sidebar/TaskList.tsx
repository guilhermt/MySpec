import { useCallback, useRef } from "react";
import { emptyTasksText, taskRows } from "@/features/sidebar/task-list";
import { useTaskListKeyboard } from "@/features/sidebar/useTaskListKeyboard";
import { StatusDot } from "@/features/task/StatusDot";
import { taskStatusLabel } from "@/features/task/status";
import { situationTone } from "@/lib/situations";
import { cn } from "@/lib/utils";
import { useAppStore, useFilteredTasks, useFlashing, useRepositoryFilter } from "@/store/app-store";

const ROW_CLASS =
  "flex h-12 cursor-default flex-col justify-center gap-0.5 rounded-md px-2 outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

/** TaskList is every active task of the filter, in the order they were created. */
export function TaskList() {
  const app = useAppStore((state) => state.app);
  const openTask = useAppStore((state) => state.openTask);
  const openTaskId = useAppStore((state) => state.openTaskId);
  const tasks = useFilteredTasks();
  const flashing = useFlashing();
  const filter = useRepositoryFilter();
  const listRef = useRef<HTMLDivElement>(null);

  const rows = taskRows(tasks, openTaskId, flashing);
  const noneSelected = !rows.some((row) => row.selected);

  const focusRowAt = useCallback((index: number) => {
    listRef.current?.querySelectorAll<HTMLElement>('[role="option"]').item(index)?.focus();
  }, []);

  const onKeyDown = useTaskListKeyboard(rows, focusRowAt);

  if (app === null) {
    return null;
  }

  if (rows.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">{emptyTasksText(app, filter)}</p>;
  }

  return (
    <div
      role="listbox"
      aria-label="Tasks"
      ref={listRef}
      onKeyDown={onKeyDown}
      className="flex flex-col p-1"
    >
      {rows.map((row, index) => {
        // The highlight takes the tone of the most urgent situation of the task.
        const [urgent] = row.task.situations ?? [];
        const flashTone = row.flashing && urgent !== undefined ? situationTone(urgent) : undefined;
        return (
          // biome-ignore lint/a11y/useKeyWithClickEvents: the list owns the keyboard for every row
          <div
            key={row.task.id}
            role="option"
            aria-selected={row.selected}
            aria-label={`${row.task.name}, ${row.fullName}, ${taskStatusLabel(row.task)}`}
            tabIndex={row.selected || (noneSelected && index === 0) ? 0 : -1}
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
              {row.shortName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
