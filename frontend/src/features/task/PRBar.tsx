import {
  Archive,
  Check,
  Code,
  ExternalLink,
  GitPullRequestArrow,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  approvePRHint,
  canApprovePR,
  canCloseTask,
  canDiscardDraft,
  canOpenPR,
  canReviewAgain,
  closeHint,
  draftAtHand,
  hasPRSession,
  prStateLabel,
  prStatusLabel,
  prStatusTone,
} from "@/features/task/pr-status";
import { ToneDot } from "@/features/task/StatusDot";
import { reviewCountLabel } from "@/features/task/step-status";
import { prSituation, situationTone } from "@/lib/situations";
import {
  asPRState,
  asPRStatus,
  asSessionStatus,
  type PullRequest,
  type TaskSummary,
} from "@/lib/wails";
import {
  approvePR,
  closeTask,
  discardDraft,
  openExternal,
  openInEditor,
  openPR,
  pause,
  refreshPR,
  resume,
  reviewAgain,
} from "@/store/actions";
import { usePrDraft, useRepository } from "@/store/app-store";

// The states where the review of the applied changes is what the bar is about.
const REVIEW_STATES = ["in_review", "ready_to_approve", "committing"];

// The states where the closing of the task is what is left to do, even when
// the user cannot ask for it yet.
const CLOSING_STATES = ["done", "merged", "closing"];

// Once the closing starts, the worktree and the pull request stop being things
// the bar can act on.
const GONE_STATES = ["closing", "closed"];

/** stateText reads the state of the pull request, with the count while reviewing. */
function stateText(pr: PullRequest): string {
  const label = prStatusLabel(pr);
  const review = pr.review;
  if (review === null || review.error !== "" || review.total === 0) {
    return label;
  }
  return `${label} · ${reviewCountLabel(review)}`;
}

export interface PRBarProps {
  task: TaskSummary;
  pr: PullRequest;
}

/** PRBar names the pull request on screen and holds what can be done to it. */
export function PRBar({ task, pr }: PRBarProps) {
  const repository = useRepository(task.repositoryId);
  const edited = usePrDraft(task.id);
  const situation = prSituation(task);
  // What waits on the user takes the colour of its situation; without one, the
  // dot shows what the pull request is doing.
  const tone = situation !== null ? situationTone(situation) : prStatusTone(pr);

  const status = asPRStatus(pr.status);
  const spinning = status === "preparing" || status === "waiting_checks";
  const committing = status === "committing";
  const reviewing = REVIEW_STATES.includes(status);
  const closing = status === "closing";
  const closable = CLOSING_STATES.includes(status);
  const gone = GONE_STATES.includes(status);
  const paused = hasPRSession(pr) && asSessionStatus(pr.sessionStatus) === "paused";
  // The worktree is only there once the implementation created it, and it is
  // the first thing the closing takes away.
  const canOpenEditor = pr.worktreePath !== "" && !gone;
  const prState = prStateLabel(asPRState(pr.prState));

  const title = edited?.title ?? pr.draft?.title ?? "";
  const body = edited?.body ?? pr.draft?.body ?? "";
  const readyToOpen = canOpenPR(pr) && title.trim() !== "" && body.trim() !== "";

  const openButton = (
    <Button
      variant="outline"
      size="sm"
      disabled={!canOpenEditor}
      onClick={() => void openInEditor(task.id)}
    >
      <Code />
      Open in VS Code
    </Button>
  );

  const closeButton = (
    <Button
      variant={status === "merged" ? "default" : "outline"}
      size="sm"
      disabled={!canCloseTask(pr)}
      onClick={() => void closeTask(task.id)}
    >
      {closing ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Archive />}
      {closing ? "Closing…" : "Close task"}
    </Button>
  );

  const approveButton = (
    <Button
      variant="default"
      size="sm"
      disabled={!canApprovePR(pr)}
      onClick={() => void approvePR(task.id)}
    >
      {committing ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Check />}
      Approve
    </Button>
  );

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      {pr.prNumber > 0 ? (
        <button
          type="button"
          onClick={() => void openExternal(pr.prUrl)}
          className="flex shrink-0 items-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {`#${pr.prNumber}`}
          {prState !== "" && <Badge variant="secondary">{prState}</Badge>}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </button>
      ) : (
        <span className="font-medium">Pull request</span>
      )}
      <span
        role="status"
        aria-live="polite"
        className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        {spinning ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            {prStatusLabel(pr)}
          </>
        ) : (
          <>
            <ToneDot tone={tone} />
            {stateText(pr)}
          </>
        )}
      </span>
      {status === "done" && pr.checkError !== "" && (
        <span className="shrink-0 text-xs text-[var(--status-attention)]" title={pr.checkError}>
          Couldn't confirm the merge
        </span>
      )}
      {pr.commitFailed && (
        <span className="shrink-0 text-xs text-muted-foreground">
          The last approval didn't produce a commit.
        </span>
      )}

      <span className="flex-1" />

      {draftAtHand(pr) && (
        <Button size="sm" disabled={!readyToOpen} onClick={() => void openPR(task.id, title, body)}>
          <GitPullRequestArrow />
          Open PR
        </Button>
      )}

      {reviewing &&
        (canApprovePR(pr) || committing ? (
          approveButton
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span />}>{approveButton}</TooltipTrigger>
            <TooltipContent>{approvePRHint(pr)}</TooltipContent>
          </Tooltip>
        ))}

      {closable &&
        (canCloseTask(pr) || closing ? (
          closeButton
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span />}>{closeButton}</TooltipTrigger>
            <TooltipContent>{closeHint(pr, repository)}</TooltipContent>
          </Tooltip>
        ))}

      {/* The worktree of a closed task is gone; there is nothing to open. */}
      {!gone &&
        (canOpenEditor ? (
          openButton
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span />}>{openButton}</TooltipTrigger>
            <TooltipContent>The worktree doesn't exist yet</TooltipContent>
          </Tooltip>
        ))}

      {hasPRSession(pr) && (
        <Button
          variant="ghost"
          size="sm"
          disabled={!paused && asSessionStatus(pr.sessionStatus) === "error"}
          onClick={() =>
            void (paused ? resume(task.id, pr.sessionStage) : pause(task.id, pr.sessionStage))
          }
        >
          {paused ? <Play /> : <Pause />}
          {paused ? "Resume" : "Pause"}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label="Pull request actions"
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-44">
          <DropdownMenuItem
            disabled={!canReviewAgain(pr)}
            onClick={() => void reviewAgain(task.id)}
          >
            Review again
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canDiscardDraft(pr)}
            onClick={() => void discardDraft(task.id)}
          >
            Discard draft
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pr.prNumber === 0 || gone}
            onClick={() => void refreshPR(task.id)}
          >
            Refresh PR
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
