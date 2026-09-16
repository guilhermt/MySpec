import { GitPullRequestArrow } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canOpenPR } from "@/features/task/pr-status";
import type { PullRequest } from "@/lib/wails";
import { openPR } from "@/store/actions";
import { useAppStore, usePrDraft } from "@/store/app-store";

export interface DraftCardProps {
  taskId: string;
  pr: PullRequest;
}

/**
 * DraftCard is the pull request the agent wrote, as the user edits it. The
 * draft on disk is the starting point; what the user types survives every
 * update but one, and only opening the pull request sends it.
 */
export function DraftCard({ taskId, pr }: DraftCardProps) {
  const edited = usePrDraft(taskId);
  const setPrDraft = useAppStore((state) => state.setPrDraft);
  const clearPrDraft = useAppStore((state) => state.clearPrDraft);

  const fileTitle = pr.draft?.title ?? "";
  const fileBody = pr.draft?.body ?? "";
  const written = useRef({ key: taskId, fileTitle, fileBody });

  // The one update the edit of the user does not survive is the agent writing
  // the draft again: that is what the user asked for, so it wins.
  useEffect(() => {
    const seen = written.current;
    written.current = { key: taskId, fileTitle, fileBody };
    if (seen.key !== taskId || (seen.fileTitle === fileTitle && seen.fileBody === fileBody)) {
      return;
    }
    clearPrDraft(taskId);
  }, [taskId, fileTitle, fileBody, clearPrDraft]);

  const title = edited?.title ?? fileTitle;
  const body = edited?.body ?? fileBody;
  const ready = canOpenPR(pr) && title.trim() !== "" && body.trim() !== "";

  const edit = (next: { title?: string; body?: string }) =>
    setPrDraft(taskId, { title, body, ...next });

  return (
    <div className="shrink-0 border-b px-3 py-3">
      <div className="mx-auto flex w-full max-w-[58.5rem] flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">Pull request draft</p>
          <p className="text-xs text-muted-foreground">
            base: <span className="font-mono">{pr.baseBranch}</span>
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`pr-title-${taskId}`} className="text-xs text-muted-foreground">
            Title
          </label>
          <Input
            id={`pr-title-${taskId}`}
            value={title}
            onChange={(event) => edit({ title: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`pr-body-${taskId}`} className="text-xs text-muted-foreground">
            Description
          </label>
          <Textarea
            id={`pr-body-${taskId}`}
            value={body}
            onChange={(event) => edit({ body: event.target.value })}
            className="max-h-72 min-h-32 resize-none font-mono text-xs"
          />
        </div>
        <div className="flex items-center justify-end">
          <Button size="sm" disabled={!ready} onClick={() => void openPR(taskId, title, body)}>
            <GitPullRequestArrow />
            Open PR
          </Button>
        </div>
      </div>
    </div>
  );
}
