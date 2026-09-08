import { ExternalLink } from "lucide-react";
import { repoName } from "@/features/task/repo-status";
import { reposOf } from "@/lib/repos";
import type { RepoPR, TaskSummary } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** openPRsOf is every pull request of a task that is still on GitHub. */
export function openPRsOf(task: TaskSummary): readonly RepoPR[] {
  return reposOf(task).filter((repo) => repo.prNumber > 0);
}

export interface OrphanPRsProps {
  task: TaskSummary;
}

/**
 * OrphanPRs warns about the pull requests an action leaves behind. The app
 * never closes one, so what happens to them on GitHub is the user's to decide.
 */
export function OrphanPRs({ task }: OrphanPRsProps) {
  const app = useAppStore((state) => state.app);
  const prs = openPRsOf(task);

  if (prs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
      <p>
        {prs.length === 1
          ? "This pull request stays open on GitHub:"
          : "These pull requests stay open on GitHub:"}
      </p>
      <ul className="flex flex-col gap-0.5">
        {prs.map((repo) => (
          <li key={repo.repoPath}>
            <button
              type="button"
              onClick={() => void openExternal(repo.prUrl)}
              className="flex items-center gap-1.5 rounded-md transition-colors hover:text-foreground"
            >
              <span className="tabular-nums">{`#${repo.prNumber}`}</span>
              <span className="min-w-0 truncate">{repoName(app, repo)}</span>
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">Closing them on GitHub is up to you.</p>
    </div>
  );
}
