import { Archive, ExternalLink, LoaderCircle, RefreshCw, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Composer } from "@/features/chat/Composer";
import { Conversation } from "@/features/chat/Conversation";
import { DraftCard } from "@/features/task/DraftCard";
import { PRBlocked } from "@/features/task/PRBlocked";
import {
  canCloseTask,
  closeHint,
  closeStepLabel,
  draftAtHand,
  hasPRSession,
  prBaseName,
  prReportLabel,
  prStateLabel,
} from "@/features/task/pr-status";
import { ReviewStrip } from "@/features/task/ReviewStrip";
import { ToneDot } from "@/features/task/StatusDot";
import type { StatusTone } from "@/features/task/status";
import {
  asCloseOutcome,
  asPRState,
  asPRStatus,
  type CloseOutcome,
  type CloseResult,
  type PullRequest,
  type TaskSummary,
} from "@/lib/wails";
import { closeTask, openExternal, refreshPR, reviewAgain } from "@/store/actions";
import { useRepository } from "@/store/app-store";

// The three parts of a closing, in the order the app carries them out.
const CLOSE_PARTS = ["worktree", "branch", "base"] as const;

/** Waiting is what the pane shows while there is nothing to read yet. */
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

/** Note is what the pane shows when it has no conversation to show. */
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

/** PRLink opens the pull request of the task where GitHub keeps it. */
function PRLink({ pr }: { pr: PullRequest }) {
  const state = prStateLabel(asPRState(pr.prState));

  if (pr.prNumber === 0) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={() => void openExternal(pr.prUrl)}
      className="flex w-fit items-center gap-1.5 rounded-md text-sm transition-colors hover:text-foreground"
    >
      <span className="tabular-nums">{`#${pr.prNumber}`}</span>
      {state !== "" && <Badge variant="secondary">{state}</Badge>}
      <ExternalLink aria-hidden="true" className="size-3.5" />
    </button>
  );
}

/** AwaitingMerge is a pull request whose review closed clean, waiting for the merge. */
function AwaitingMerge({ taskId, pr }: { taskId: string; pr: PullRequest }) {
  const reports = pr.reports ?? [];

  return (
    <Note title="The pull request is waiting for the merge">
      <p className="text-sm text-muted-foreground">
        The last review pass closed with nothing to change. Merge it on GitHub; the app checks every
        minute and offers the closing once it's merged.
      </p>
      {pr.checkError !== "" && (
        <p className="text-sm text-muted-foreground">
          {`The merge couldn't be confirmed: ${pr.checkError}. If you merged it, close the task anyway.`}
        </p>
      )}
      <PRLink pr={pr} />
      {reports.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          {reports.map((report) => (
            <li key={report.file}>{prReportLabel(report.pass, report.clean)}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => void reviewAgain(taskId)}>
          <RotateCcw />
          Review again
        </Button>
        <Button variant="outline" size="sm" onClick={() => void refreshPR(taskId)}>
          <RefreshCw />
          Refresh PR
        </Button>
      </div>
    </Note>
  );
}

/** Troubled is a pull request that stopped being ready after its review: a check failed or a conflict with its base came up. */
function Troubled({ taskId, pr }: { taskId: string; pr: PullRequest }) {
  const checks = pr.trouble.failedChecks ?? [];

  return (
    <Note title="The pull request is no longer ready to merge">
      <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
        {checks.map((name) => (
          <li key={name}>{`Check failed: ${name}`}</li>
        ))}
        {pr.trouble.conflict && <li>{`Conflict with ${prBaseName(pr)}`}</li>}
      </ul>
      <p className="text-sm text-muted-foreground">
        Review again reads GitHub and turns this into findings of a new pass.
      </p>
      {pr.checkError !== "" && (
        <p className="text-sm text-muted-foreground">
          {`The merge couldn't be confirmed: ${pr.checkError}. If you merged it, close the task anyway.`}
        </p>
      )}
      <PRLink pr={pr} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => void reviewAgain(taskId)}>
          <RotateCcw />
          Review again
        </Button>
        <Button variant="outline" size="sm" onClick={() => void refreshPR(taskId)}>
          <RefreshCw />
          Refresh PR
        </Button>
      </div>
    </Note>
  );
}

/** Merged is a pull request that landed, with only the closing left. */
function Merged({ task, pr }: { task: TaskSummary; pr: PullRequest }) {
  const repository = useRepository(task.repositoryId);
  // The base of the pull request is what was really merged into; before GitHub
  // says, the base the worktree was branched from is the best the app knows.
  const base = prBaseName(pr);
  const hint = closeHint(pr, repository);

  return (
    <Note title="The pull request was merged">
      <p className="text-sm text-muted-foreground">
        {`Closing removes the worktree and the branch of the task and brings ${base} up to date when that is a fast-forward. Nothing else in the repository is touched.`}
      </p>
      <PRLink pr={pr} />
      <div>
        <Button size="sm" disabled={!canCloseTask(pr)} onClick={() => void closeTask(task.id)}>
          <Archive />
          Close task
        </Button>
      </div>
      {!canCloseTask(pr) && hint !== "" && <p className="text-sm text-muted-foreground">{hint}</p>}
    </Note>
  );
}

/** PRClosedUnmerged is a pull request that was closed without a merge. */
function PRClosedUnmerged({ taskId, pr }: { taskId: string; pr: PullRequest }) {
  return (
    <Note title="The pull request was closed without a merge">
      <p className="text-sm text-muted-foreground">
        The work wasn't integrated. Reopen the pull request on GitHub and refresh, or delete the
        task.
      </p>
      <PRLink pr={pr} />
      <div>
        <Button variant="outline" size="sm" onClick={() => void refreshPR(taskId)}>
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

/** ClosedSummary is what closing the task did, as it reads forever after. */
function ClosedSummary({ pr }: { pr: PullRequest }) {
  const result = pr.close;
  const title = "The task is closed";

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
      <PRLink pr={pr} />
      <p className="text-xs text-muted-foreground">
        {`Closed on ${new Date(result.closedAt).toLocaleString()}`}
      </p>
    </Note>
  );
}

/** Chat is the conversation of the PR stage and the field to answer it. */
function Chat({ taskId, pr }: { taskId: string; pr: PullRequest }) {
  return (
    <>
      <Conversation
        key={`conversation:${pr.sessionStage}`}
        taskId={taskId}
        stage={pr.sessionStage}
        session={pr}
      />
      <Composer taskId={taskId} stage={pr.sessionStage} session={pr} />
    </>
  );
}

export interface PRPaneProps {
  task: TaskSummary;
  pr: PullRequest;
}

/** PRPane is what the PR stage shows below the bar of the pull request. */
export function PRPane({ task, pr }: PRPaneProps) {
  switch (asPRStatus(pr.status)) {
    case "preparing":
      return <Waiting text="Checking GitHub…" />;
    case "blocked":
      return <PRBlocked taskId={task.id} pr={pr} />;
    case "draft_ready":
      return (
        <>
          <DraftCard taskId={task.id} pr={pr} />
          <Chat taskId={task.id} pr={pr} />
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
          <Chat taskId={task.id} pr={pr} />
        </>
      );
    case "in_review":
    case "ready_to_approve":
    case "committing":
      return (
        <>
          {pr.review !== null && <ReviewStrip taskId={task.id} subject="pr" review={pr.review} />}
          <Chat taskId={task.id} pr={pr} />
        </>
      );
    case "awaiting_reply":
      // Only the draft an opening that failed left is still there to send.
      return (
        <>
          {draftAtHand(pr) && <DraftCard taskId={task.id} pr={pr} />}
          <Chat taskId={task.id} pr={pr} />
        </>
      );
    case "drafting":
    case "reviewing":
    case "awaiting_decision":
      return <Chat taskId={task.id} pr={pr} />;
    case "waiting_checks":
      return hasPRSession(pr) ? (
        <Chat taskId={task.id} pr={pr} />
      ) : (
        <Waiting text="Waiting for the checks of the pull request…" />
      );
    case "done":
      return <AwaitingMerge taskId={task.id} pr={pr} />;
    case "trouble":
      return <Troubled taskId={task.id} pr={pr} />;
    case "merged":
      return <Merged task={task} pr={pr} />;
    case "pr_closed":
      return <PRClosedUnmerged taskId={task.id} pr={pr} />;
    case "closing":
      return <Waiting text="Closing the task…" />;
    case "closed":
      return <ClosedSummary pr={pr} />;
  }
}
