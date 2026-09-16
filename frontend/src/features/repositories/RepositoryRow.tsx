import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RemoveRepositoryDialog } from "@/features/repositories/RemoveRepositoryDialog";
import { cloneMissingText, removeBlockedText, taskCount } from "@/lib/repositories";
import type { Repository } from "@/lib/wails";
import { changeRepositoryPath } from "@/store/actions";

export interface RepositoryRowProps {
  repository: Repository;
}

/** RepositoryRow is one registered repository: where its clone is, what it holds, and what can be done to it. */
export function RepositoryRow({ repository }: RepositoryRowProps) {
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const blocked = removeBlockedText(repository);

  const change = async () => {
    setError(null);
    try {
      await changeRepositoryPath(repository.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
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
        <span className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => void change()}>
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
      <p className="break-all font-mono text-xs text-muted-foreground">{repository.path}</p>
      <p className="text-xs text-muted-foreground">
        {`${taskCount(repository.activeTasks, "active")} · ${taskCount(repository.archivedTasks, "archived")}`}
      </p>
      {repository.missing && (
        <p className="flex items-start gap-1.5 text-xs text-[var(--status-attention)]">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-all">{cloneMissingText(repository)}</span>
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
