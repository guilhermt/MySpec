import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prBlockHint, prBlockTitle } from "@/features/task/repo-status";
import { asPRBlockReason, type RepoPR } from "@/lib/wails";
import { retryRepo } from "@/store/actions";

export interface RepoBlockedProps {
  taskId: string;
  repo: RepoPR;
}

/**
 * RepoBlocked is why the PR stage of a repository could not go on and how to
 * get out of it. What gh or git said is shown as they said it, never
 * translated.
 */
export function RepoBlocked({ taskId, repo }: RepoBlockedProps) {
  const reason = asPRBlockReason(repo.block?.reason ?? "");
  const detail = repo.block?.detail ?? "";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[58.5rem] flex-col gap-4">
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
        >
          <p className="font-medium">{prBlockTitle(reason)}</p>
          <p className="text-sm">{prBlockHint(reason)}</p>
          {detail !== "" && (
            <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap select-text">
              {detail}
            </pre>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void retryRepo(taskId, repo.repoPath)}>
            <RotateCcw />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
