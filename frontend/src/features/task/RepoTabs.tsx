import { ExternalLink } from "lucide-react";
import { repoStatusLabel, repoStatusTone } from "@/features/task/repo-status";
import { ToneDot } from "@/features/task/StatusDot";
import { repoName } from "@/lib/repos";
import { repoSituation, situationLabel, situationTone } from "@/lib/situations";
import { cn } from "@/lib/utils";
import type { RepoPR, TaskSummary } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { useAppStore, useFlashing, useOpenRepo, useRepos } from "@/store/app-store";

export interface RepoTabsProps {
  task: TaskSummary;
}

/**
 * RepoTabs is the strip of repositories of a task in the PR stage. It stays
 * even with a single repository: it is where the pull request link and its
 * state live.
 */
export function RepoTabs({ task }: RepoTabsProps) {
  const app = useAppStore((state) => state.app);
  const repos = useRepos(task.id);
  const openRepo = useOpenRepo(task.id);
  const selectRepo = useAppStore((state) => state.selectRepo);

  if (repos.length === 0) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Repositories"
      className="flex h-9 shrink-0 items-center border-b px-2"
    >
      {repos.map((repo) => (
        <Tab
          key={repo.repoPath}
          task={task}
          repo={repo}
          name={repoName(app, repo)}
          selected={repo.repoPath === openRepo}
          onSelect={() => selectRepo(task.id, repo.repoPath)}
        />
      ))}
    </div>
  );
}

interface TabProps {
  task: TaskSummary;
  repo: RepoPR;
  name: string;
  selected: boolean;
  onSelect: () => void;
}

function Tab({ task, repo, name, selected, onSelect }: TabProps) {
  const flashing = useFlashing();
  const situation = repoSituation(task, repo.repoPath);
  // What waits on the user takes the colour of its situation; without one, the
  // tab shows what the repository is doing.
  const tone = situation !== null ? situationTone(situation) : repoStatusTone(repo);
  // A new situation draws the eye to a tab the user is not on; the selected
  // one is already in front of them.
  const flash = !selected && situation !== null && flashing.has(situation.id);

  return (
    // min-w-0 down to the texts lets a crowded strip shorten the name and the
    // label, on one line, instead of growing or spilling out.
    <span className="flex min-w-0 items-center">
      <button
        type="button"
        role="tab"
        aria-selected={selected}
        onClick={onSelect}
        data-tone={flash ? tone : undefined}
        className={cn(
          "flex h-9 min-w-0 items-center gap-1.5 border-b-2 px-2 text-sm transition-colors",
          selected
            ? "border-foreground font-medium"
            : "border-transparent text-muted-foreground hover:text-foreground",
          flash && "attention-flash",
        )}
      >
        <ToneDot tone={tone} />
        <span className="max-w-40 truncate">{name}</span>
        {/* The spaces keep the accessible name of the tab readable. */}{" "}
        {situation !== null ? (
          <span className="truncate text-xs text-muted-foreground">
            {situationLabel(situation)}
          </span>
        ) : (
          <span className="sr-only">{repoStatusLabel(repo)}</span>
        )}
        {repo.prNumber > 0 && (
          <>
            {" "}
            <span className="text-xs text-muted-foreground tabular-nums">{`#${repo.prNumber}`}</span>
          </>
        )}
      </button>
      {repo.prUrl !== "" && (
        <button
          type="button"
          aria-label={`Open pull request #${repo.prNumber} on GitHub`}
          onClick={() => void openExternal(repo.prUrl)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </span>
  );
}
