import { ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Composer } from "@/features/chat/Composer";
import { Conversation } from "@/features/chat/Conversation";
import { DraftCard } from "@/features/task/DraftCard";
import { RepoBlocked } from "@/features/task/RepoBlocked";
import { ReviewStrip } from "@/features/task/ReviewStrip";
import { prReportLabel, prStateLabel, repoName } from "@/features/task/repo-status";
import { asPRState, asRepoStatus, type RepoPR } from "@/lib/wails";
import { openExternal, reviewAgain } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

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
      <div className="mx-auto flex max-w-[760px] flex-col gap-3 rounded-lg border p-4">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** RepoClosed is a repository whose review closed clean, waiting to be closed. */
function RepoClosed({ taskId, repo }: { taskId: string; repo: RepoPR }) {
  const app = useAppStore((state) => state.app);
  const reports = repo.reports ?? [];
  const state = prStateLabel(asPRState(repo.prState));

  return (
    <Note title={`The pull request of ${repoName(app, repo)} is ready to be closed`}>
      <p className="text-sm text-muted-foreground">
        The last review pass closed with nothing to change. Merging or closing the pull request on
        GitHub is yours to do.
      </p>
      {repo.prNumber > 0 && (
        <button
          type="button"
          onClick={() => void openExternal(repo.prUrl)}
          className="flex w-fit items-center gap-1.5 rounded-md text-sm transition-colors hover:text-foreground"
        >
          <span className="tabular-nums">{`#${repo.prNumber}`}</span>
          {state !== "" && <Badge variant="secondary">{state}</Badge>}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </button>
      )}
      {reports.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          {reports.map((report) => (
            <li key={report.file}>{prReportLabel(report.pass, report.clean)}</li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="outline" size="sm" onClick={() => void reviewAgain(taskId, repo.repoPath)}>
          <RotateCcw />
          Review again
        </Button>
      </div>
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
    case "reviewing":
    case "awaiting_decision":
      return <Chat taskId={taskId} repo={repo} />;
    case "done":
      return <RepoClosed taskId={taskId} repo={repo} />;
    case "skipped":
      return (
        <Note title="No changes to open a pull request with">
          <p className="text-sm text-muted-foreground">
            The branch of this repository has no commit past its base, so there is nothing to
            propose.
          </p>
        </Note>
      );
  }
}
