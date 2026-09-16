import { ExternalLink } from "lucide-react";
import { prOf } from "@/lib/pull-requests";
import type { PRPreview, TaskSummary } from "@/lib/wails";
import { openExternal } from "@/store/actions";

/** openPROf is the pull request of a task that is still on GitHub, null when there is none. */
export function openPROf(task: TaskSummary): PRPreview | null {
  const pr = prOf(task);
  if (pr === null || pr.prNumber === 0) {
    return null;
  }
  return { number: pr.prNumber, url: pr.prUrl, state: pr.prState };
}

export interface OrphanPRProps {
  pr: PRPreview | null;
}

/**
 * OrphanPR warns about the pull request an action leaves behind. The app never
 * closes one, so what happens to it on GitHub is the user's to decide.
 */
export function OrphanPR({ pr }: OrphanPRProps) {
  if (pr === null) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
      <p>This pull request stays open on GitHub:</p>
      <button
        type="button"
        onClick={() => void openExternal(pr.url)}
        className="flex w-fit items-center gap-1.5 rounded-md transition-colors hover:text-foreground"
      >
        <span className="tabular-nums">{`#${pr.number}`}</span>
        <ExternalLink aria-hidden="true" className="size-3.5" />
      </button>
      <p className="text-muted-foreground">Closing it on GitHub is up to you.</p>
    </div>
  );
}
