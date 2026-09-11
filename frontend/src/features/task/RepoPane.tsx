import { Archive, ExternalLink, LoaderCircle, RefreshCw, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Composer } from "@/features/chat/Composer";
import { Conversation } from "@/features/chat/Conversation";
import { DraftCard } from "@/features/task/DraftCard";
import { RepoBlocked } from "@/features/task/RepoBlocked";
import { ReviewStrip } from "@/features/task/ReviewStrip";
import { closeStepLabel, prReportLabel, prStateLabel, repoName } from "@/features/task/repo-status";
import { ToneDot } from "@/features/task/StatusDot";
import type { StatusTone } from "@/features/task/status";
import {
  asCloseOutcome,
  asPRState,
  asRepoStatus,
  type CloseOutcome,
  type CloseResult,
  type RepoPR,
} from "@/lib/wails";
import { closeRepo, openExternal, refreshPR, reviewAgain } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

// The three parts of a closing, in the order the app carries them out.
const CLOSE_PARTS = ["worktree", "branch", "base"] as const;

/** Waiting is what a repository shows while there is nothing to read yet. */
function Waiting({ text }: { text: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        {text}
      </p>
    </div>
  );
}

/** Note is what a repository shows when it has no conversation to show. */
function Note({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-[58.5rem] flex-col gap-3 rounded-lg border p-4">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** PRLink opens the pull request of a repository where GitHub keeps it. */
function PRLink({ repo }: { repo: RepoPR }) {
  const state = prStateLabel(asPRState(repo.prState));

  if (repo.prNumber === 0) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={() => void openExternal(repo.prUrl)}
      className="flex w-fit items-center gap-1.5 rounded-md text-sm transition-colors hover:text-foreground"
    >
      <span className="tabular-nums">{`#${repo.prNumber}`}</span>
      {state !== "" && <Badge variant="secondary">{state}</Badge>}
      <ExternalLink aria-hidden="true" className="size-3.5" />
    </button>
  );
}

/** RepoAwaitingMerge is a repository whose review closed clean, waiting for the merge. */
function RepoAwaitingMerge({ taskId, repo }: { taskId: string; repo: RepoPR }) {
  const app = useAppStore((state) => state.app);
  const reports = repo.reports ?? [];

  return (
    <Note title={`The pull request of ${repoName(app, repo)} is waiting for the merge`}>
      <p className="text-sm text-muted-foreground">
        The last review pass closed with nothing to change. Merge it on GitHub; the app checks every
        minute and offers the closing once it's merged.
      </p>
      {repo.checkError !== "" && (
        <p className="text-sm text-muted-foreground">
          {`The merge couldn't be confirmed: ${repo.checkError}. If you merged it, close the repository anyway.`}
        </p>
      )}
      <PRLink repo={repo} />
      {reports.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          {reports.map((report) => (
            <li key={report.file}>{prReportLabel(report.pass, report.clean)}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => void reviewAgain(taskId, repo.repoPath)}>
          <RotateCcw />
          Review again
        </Button>
        <Button variant="outline" size="sm" onClick={() => void refreshPR(taskId, repo.repoPath)}>
          <RefreshCw />
          Refresh PR
        </Button>
      </div>
    </Note>
  );
}

/** RepoMerged is a repository whose pull request landed and only waits for the closing. */
function RepoMerged({ taskId, repo }: { taskId: string; repo: RepoPR }) {
  const app = useAppStore((state) => state.app);
  // The base of the pull request is what was really merged into; before GitHub
  // says, the base the worktree was branched from is the best the app knows.
  const base = repo.prBase !== "" ? repo.prBase : repo.baseBranch.replace(/^origin\//, "");

  return (
    <Note title={`The pull request of ${repoName(app, repo)} was merged`}>
      <p className="text-sm text-muted-foreground">
        {`Closing removes the worktree and the branch of the task and brings ${base} up to date when that is a fast-forward. Nothing else in the repository is touched.`}
      </p>
      <PRLink repo={repo} />
      <div>
        <Button size="sm" onClick={() => void closeRepo(taskId, repo.repoPath)}>
          <Archive />
          Close repository
        </Button>
      </div>
    </Note>
  );
}

/** RepoPRClosed is a repository whose pull request was closed without a merge. */
function RepoPRClosed({ taskId, repo }: { taskId: string; repo: RepoPR }) {
  const app = useAppStore((state) => state.app);

  return (
    <Note title={`The pull request of ${repoName(app, repo)} was closed without a merge`}>
      <p className="text-sm text-muted-foreground">
        The work wasn't integrated. Reopen the pull request on GitHub and refresh, or delete the
        task.
      </p>
      <PRLink repo={repo} />
      <div>
        <Button variant="outline" size="sm" onClick={() => void refreshPR(taskId, repo.repoPath)}>
          <RefreshCw />
          Refresh PR
        </Button>
      </div>
    </Note>
  );
}

/** outcomeTone is the colour of one part of a closing. */
function outcomeTone(outcome: CloseOutcome): StatusTone {
  switch (outcome) {
    case "done":
      return "done";
    case "skipped":
      return "idle";
    case "failed":
      return "error";
  }
}

/** leftBehind is what the closing could not remove: a folder, a branch, or both. */
function leftBehind(result: CloseResult): string[] {
  const left: string[] = [];
  if (asCloseOutcome(result.worktree.outcome) === "failed") {
    left.push(result.worktreePath);
  }
  if (asCloseOutcome(result.branch.outcome) === "failed") {
    left.push(result.branchName);
  }
  return left;
}

/** RepoClosedSummary is what closing a repository did, as it reads forever after. */
function RepoClosedSummary({ repo }: { repo: RepoPR }) {
  const app = useAppStore((state) => state.app);
  const result = repo.close;
  const title = `${repoName(app, repo)} is closed`;

  // The record of the closing arrives with the state that names it; without it
  // there is nothing to summarise.
  if (result === null) {
    return <Note title={title} />;
  }
  const left = leftBehind(result);

  return (
    <Note title={title}>
      <ul className="flex flex-col gap-1 text-sm">
        {CLOSE_PARTS.map((part) => (
          <li key={part} className="flex items-center gap-2">
            <ToneDot tone={outcomeTone(asCloseOutcome(result[part].outcome))} />
            {closeStepLabel(part, result)}
          </li>
        ))}
      </ul>
      {left.length > 0 && (
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>What stayed behind is yours to remove:</p>
          <ul className="flex flex-col gap-0.5">
            {left.map((item) => (
              <li key={item} className="font-mono text-xs break-all">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      <PRLink repo={repo} />
      <p className="text-xs text-muted-foreground">
        {`Closed on ${new Date(result.closedAt).toLocaleString()}`}
      </p>
    </Note>
  );
}

/** Chat is the conversation of a repository and the field to answer it. */
function Chat({ taskId, repo }: { taskId: string; repo: RepoPR }) {
  return (
    <>
      <Conversation taskId={taskId} stage={repo.sessionStage} session={repo} />
      <Composer taskId={taskId} stage={repo.sessionStage} session={repo} />
    </>
  );
}

export interface RepoPaneProps {
  taskId: string;
  repo: RepoPR;
}

/** RepoPane is what the PR stage shows below the bar of the selected repository. */
export function RepoPane({ taskId, repo }: RepoPaneProps) {
  switch (asRepoStatus(repo.status)) {
    case "preparing":
      return <Waiting text="Checking GitHub…" />;
    case "blocked":
      return <RepoBlocked taskId={taskId} repo={repo} />;
    case "draft_ready":
      return (
        <>
          <DraftCard taskId={taskId} repo={repo} />
          <Chat taskId={taskId} repo={repo} />
        </>
      );
    case "opening":
      return (
        <>
          <div className="shrink-0 border-b px-3 py-2">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
              Opening the pull request…
            </p>
          </div>
          <Chat taskId={taskId} repo={repo} />
        </>
      );
    case "in_review":
    case "ready_to_approve":
    case "committing":
      return (
        <>
          {repo.review !== null && (
            <ReviewStrip taskId={taskId} repoPath={repo.repoPath} review={repo.review} />
          )}
          <Chat taskId={taskId} repo={repo} />
        </>
      );
    case "drafting":
    case "awaiting_reply":
    case "reviewing":
    case "awaiting_decision":
      return <Chat taskId={taskId} repo={repo} />;
    case "done":
      return <RepoAwaitingMerge taskId={taskId} repo={repo} />;
    case "merged":
      return <RepoMerged taskId={taskId} repo={repo} />;
    case "pr_closed":
      return <RepoPRClosed taskId={taskId} repo={repo} />;
    case "closing":
      return <Waiting text="Closing the repository…" />;
    case "closed":
      return <RepoClosedSummary repo={repo} />;
    case "skipped":
      return (
        <Note title="No changes to open a pull request with">
          <p className="text-sm text-muted-foreground">
            The branch of this repository has no commit past its base, so there is nothing to
            propose. Close it to remove the worktree and the branch.
          </p>
          <div>
            <Button size="sm" onClick={() => void closeRepo(taskId, repo.repoPath)}>
              <Archive />
              Close repository
            </Button>
          </div>
        </Note>
      );
  }
}
