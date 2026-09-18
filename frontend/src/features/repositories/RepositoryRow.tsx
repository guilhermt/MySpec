import { ChevronRight, LoaderCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RemoveRepositoryDialog } from "@/features/repositories/RemoveRepositoryDialog";
import { messageOf } from "@/lib/errors";
import { cloneMissingText, removeBlockedText, repositoryCounts } from "@/lib/repositories";
import { cn } from "@/lib/utils";
import type { Repository } from "@/lib/wails";
import { changeRepositoryPath, cloneRepository, setReviewInstructions } from "@/store/actions";
import { useBoard } from "@/store/app-store";

interface ReviewInstructionsProps {
  repository: Repository;
  /** attempt runs an action, showing its refusal on the row; true when it went through. */
  attempt: (action: () => Promise<unknown>) => Promise<boolean>;
}

/**
 * ReviewInstructions is what every review of a pull request of the repository
 * is told, edited in place. The saved text shows until the user changes it.
 */
function ReviewInstructions({ repository, attempt }: ReviewInstructionsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const saved = repository.reviewInstructions;
  const text = draft ?? saved;

  const save = async () => {
    if (await attempt(() => setReviewInstructions(repository.id, text))) {
      setDraft(null);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight
          aria-hidden="true"
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
        />
        Review instructions
        <span className="font-medium">{saved.trim() === "" ? "None" : "Set"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 pt-2">
        <Textarea
          rows={6}
          aria-label={`Review instructions for ${repository.fullName}`}
          value={text}
          onChange={(event) => setDraft(event.target.value)}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Added to every pull request review of this repository, including the reviews of task pull
          requests.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(null);
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button size="sm" disabled={text === saved} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export interface RepositoryRowProps {
  repository: Repository;
}

/**
 * RepositoryRow is one registered repository: its board, where its clone is,
 * what it holds, what its reviews are told, and what can be done to it.
 */
export function RepositoryRow({ repository }: RepositoryRowProps) {
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const board = useBoard(repository.boardId);
  const blocked = removeBlockedText(repository);

  // The refusal of an action shows on the row that asked for it.
  const attempt = async (action: () => Promise<unknown>): Promise<boolean> => {
    setError(null);
    try {
      await action();
      return true;
    } catch (failure) {
      setError(messageOf(failure));
      return false;
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
      <p className="text-xs text-muted-foreground">{repositoryCounts(repository)}</p>
      <ReviewInstructions repository={repository} attempt={attempt} />
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
