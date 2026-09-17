import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RemoveRepositoryDialog } from "@/features/repositories/RemoveRepositoryDialog";
import { messageOf } from "@/lib/errors";
import { cloneMissingText, removeBlockedText, taskCount } from "@/lib/repositories";
import type { Repository } from "@/lib/wails";
import { changeRepositoryPath, cloneRepository } from "@/store/actions";
import { useBoard } from "@/store/app-store";

export interface RepositoryRowProps {
  repository: Repository;
}

/**
 * RepositoryRow is one registered repository: its board, where its clone is,
 * what it holds, and what can be done to it.
 */
export function RepositoryRow({ repository }: RepositoryRowProps) {
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const board = useBoard(repository.boardId);
  const blocked = removeBlockedText(repository);

  // The refusal of an action shows on the row that asked for it.
  const attempt = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(messageOf(failure));
    }
  };

  const removeButton = (
    <Button variant="ghost" size="sm" disabled={blocked !== null} onClick={() => setRemoving(true)}>
      Remove
    </Button>
  );

  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate font-medium">{repository.fullName}</span>
        {board !== null && <Badge variant="outline">{`Board: ${board.title}`}</Badge>}
        <span className="flex-1" />
        {repository.cloning && (
          <span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            Cloning…
          </span>
        )}
        {!repository.cloned && (
          <Button
            variant="outline"
            size="sm"
            disabled={repository.cloning}
            onClick={() => void attempt(() => cloneRepository(repository.id))}
          >
            Clone
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void attempt(() => changeRepositoryPath(repository.id))}
        >
          Change path
        </Button>
        {blocked === null ? (
          removeButton
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span />}>{removeButton}</TooltipTrigger>
            <TooltipContent>{blocked}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {repository.cloned ? (
        <p className="break-all font-mono text-xs text-muted-foreground">{repository.path}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Not cloned</p>
      )}
      <p className="text-xs text-muted-foreground">
        {`${taskCount(repository.activeTasks, "active")} · ${taskCount(repository.archivedTasks, "archived")}`}
      </p>
      {repository.missing && (
        <p className="flex items-start gap-1.5 text-xs text-[var(--status-attention)]">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-all">{cloneMissingText(repository)}</span>
        </p>
      )}
      {repository.cloneError !== "" && (
        <p role="alert" className="break-all text-xs text-destructive">
          {repository.cloneError}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <RemoveRepositoryDialog repository={repository} open={removing} onOpenChange={setRemoving} />
    </li>
  );
}
