import { StatusDot } from "@/features/task/StatusDot";
import { taskStatusLabel } from "@/features/task/status";
import { issueLabel } from "@/lib/boards";
import { shortName } from "@/lib/repositories";
import { cn } from "@/lib/utils";
import type { BoardCard } from "@/lib/wails";
import { useTask } from "@/store/app-store";

/** MAX_AVATARS is how many assignees a row shows. */
const MAX_AVATARS = 3;

export interface CardRowProps {
  card: BoardCard;
  /** finalSection is whether the section the row is in holds a final status. */
  finalSection: boolean;
  selected: boolean;
  /** focusable makes the row the tab stop of the list. */
  focusable: boolean;
  onSelect: () => void;
  onFocus: () => void;
}

/** CardRow is one card in the list of a board view: a single compact line. */
export function CardRow({
  card,
  finalSection,
  selected,
  focusable,
  onSelect,
  onFocus,
}: CardRowProps) {
  const task = useTask(card.activeTaskId === "" ? null : card.activeTaskId);
  // In a section that is not final a closed issue fades, with its state also in text.
  const faded = card.state === "closed" && !finalSection;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the tree owns the keyboard for every row
    <div
      role="treeitem"
      aria-selected={selected}
      tabIndex={focusable ? 0 : -1}
      data-card-key={card.key}
      onClick={onSelect}
      onFocus={onFocus}
      className={cn(
        "flex h-9 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        selected && "bg-muted",
        faded && "opacity-60",
      )}
    >
      <span className="shrink-0 text-muted-foreground tabular-nums">{issueLabel(card)}</span>
      <span className="min-w-0 truncate">{card.title}</span>
      {faded && <span className="sr-only">Closed</span>}
      {card.epic !== null && (
        <span className="min-w-0 max-w-48 shrink truncate text-xs text-muted-foreground">
          {card.epic.title}
        </span>
      )}
      <span className="flex-1" />
      {task !== null && (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <StatusDot task={task} />
          {taskStatusLabel(task)}
          {(task.situations ?? []).length > 0 && (
            <span className="text-[var(--status-attention)]">Waits for you</span>
          )}
        </span>
      )}
      {task === null && card.action === "clone" && (
        <span className="shrink-0 text-xs text-muted-foreground">Not cloned</span>
      )}
      <span className="shrink-0 text-xs text-muted-foreground" title={card.repository}>
        {shortName(card.repository)}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {(card.assignees ?? []).slice(0, MAX_AVATARS).map((assignee) =>
          assignee.avatarUrl === "" ? (
            <span key={assignee.login} className="text-xs text-muted-foreground">
              {assignee.login}
            </span>
          ) : (
            <img
              key={assignee.login}
              src={assignee.avatarUrl}
              alt={assignee.login}
              className="size-5 rounded-full"
            />
          ),
        )}
      </span>
    </div>
  );
}
