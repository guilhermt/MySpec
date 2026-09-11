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
  approveRepoHint,
  canApproveRepo,
  canCloseRepo,
  canDiscardDraft,
  canOpenPR,
  canReviewAgain,
  closeHint,
  hasRepoSession,
  prStateLabel,
  repoStatusLabel,
  repoStatusTone,
} from "@/features/task/repo-status";
import { ToneDot } from "@/features/task/StatusDot";
import { reviewCountLabel } from "@/features/task/step-status";
import { repoName } from "@/lib/repos";
import { asPRState, asRepoStatus, asSessionStatus, type RepoPR } from "@/lib/wails";
import {
  approveRepo,
  closeRepo,
  discardDraft,
  openExternal,
  openInEditor,
  openPR,
  pause,
  refreshPR,
  resume,
  reviewAgain,
} from "@/store/actions";
import { useAppStore, usePrDraft } from "@/store/app-store";

// The states where the review of the applied changes is what the bar is about.
const REVIEW_STATES = ["in_review", "ready_to_approve", "committing"];

// The states where the closing of the repository is what is left to do, even
// when the user cannot ask for it yet.
const CLOSING_STATES = ["done", "merged", "skipped", "closing"];

// Once the closing starts, the worktree and the pull request stop being things
// the bar can act on.
const GONE_STATES = ["closing", "closed"];

/** stateText reads the state of the repository, with the count while reviewing. */
function stateText(repo: RepoPR): string {
  const label = repoStatusLabel(repo);
  const review = repo.review;
  if (review === null || review.error !== "" || review.total === 0) {
    return label;
  }
  return `${label} · ${reviewCountLabel(review)}`;
}

export interface RepoBarProps {
  taskId: string;
  repo: RepoPR;
}

/** RepoBar names the repository on screen and holds what can be done to it. */
export function RepoBar({ taskId, repo }: RepoBarProps) {
  const app = useAppStore((state) => state.app);
  const edited = usePrDraft(taskId, repo.repoPath);

  const status = asRepoStatus(repo.status);
  const preparing = status === "preparing";
  const committing = status === "committing";
  const reviewing = REVIEW_STATES.includes(status);
  const closing = status === "closing";
  const closable = CLOSING_STATES.includes(status);
  const gone = GONE_STATES.includes(status);
  const paused = hasRepoSession(repo) && asSessionStatus(repo.sessionStatus) === "paused";
  // The worktree is only there once the implementation created it, and it is
  // the first thing the closing takes away.
  const canOpenEditor = repo.worktreePath !== "" && !gone;
  const prState = prStateLabel(asPRState(repo.prState));

  const title = edited?.title ?? repo.draft?.title ?? "";
  const body = edited?.body ?? repo.draft?.body ?? "";
  const readyToOpen = canOpenPR(repo) && title.trim() !== "" && body.trim() !== "";

  const openButton = (
    <Button
      variant="outline"
      size="sm"
      disabled={!canOpenEditor}
      onClick={() => void openInEditor(taskId, repo.repoPath)}
    >
      <Code />
      Open in VS Code
    </Button>
  );

  const closeButton = (
    <Button
      variant={status === "merged" || status === "skipped" ? "default" : "outline"}
      size="sm"
      disabled={!canCloseRepo(repo)}
      onClick={() => void closeRepo(taskId, repo.repoPath)}
    >
      {closing ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Archive />}
      {closing ? "Closing…" : "Close repository"}
    </Button>
  );

  const approveButton = (
    <Button
      variant="default"
      size="sm"
      disabled={!canApproveRepo(repo)}
      onClick={() => void approveRepo(taskId, repo.repoPath)}
    >
      {committing ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Check />}
      Approve
    </Button>
  );

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <span className="min-w-0 truncate font-medium">{repoName(app, repo)}</span>
      {repo.prNumber > 0 && (
        <button
          type="button"
          onClick={() => void openExternal(repo.prUrl)}
          className="flex shrink-0 items-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {`#${repo.prNumber}`}
          {prState !== "" && <Badge variant="secondary">{prState}</Badge>}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </button>
      )}
      <span
        role="status"
        aria-live="polite"
        className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        {preparing ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            {repoStatusLabel(repo)}
          </>
        ) : (
          <>
            <ToneDot tone={repoStatusTone(repo)} />
            {stateText(repo)}
          </>
        )}
      </span>
      {status === "done" && repo.checkError !== "" && (
        <span className="shrink-0 text-xs text-[var(--status-attention)]" title={repo.checkError}>
          Couldn't confirm the merge
        </span>
      )}
      {repo.commitFailed && (
        <span className="shrink-0 text-xs text-muted-foreground">
          The last approval didn't produce a commit.
        </span>
      )}

      <span className="flex-1" />

      {status === "draft_ready" && (
        <Button
          size="sm"
          disabled={!readyToOpen}
          onClick={() => void openPR(taskId, repo.repoPath, title, body)}
        >
          <GitPullRequestArrow />
          Open PR
        </Button>
      )}

      {reviewing &&
        (canApproveRepo(repo) || committing ? (
          approveButton
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span />}>{approveButton}</TooltipTrigger>
            <TooltipContent>{approveRepoHint(repo)}</TooltipContent>
          </Tooltip>
        ))}

      {closable &&
        (canCloseRepo(repo) || closing ? (
          closeButton
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span />}>{closeButton}</TooltipTrigger>
            <TooltipContent>{closeHint(repo)}</TooltipContent>
          </Tooltip>
        ))}

      {/* The worktree of a closed repository is gone; there is nothing to open. */}
      {!gone &&
        (canOpenEditor ? (
          openButton
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span />}>{openButton}</TooltipTrigger>
            <TooltipContent>The worktree doesn't exist yet</TooltipContent>
          </Tooltip>
        ))}

      {hasRepoSession(repo) && (
        <Button
          variant="ghost"
          size="sm"
          disabled={!paused && asSessionStatus(repo.sessionStatus) === "error"}
          onClick={() =>
            void (paused ? resume(taskId, repo.sessionStage) : pause(taskId, repo.sessionStage))
          }
        >
          {paused ? <Play /> : <Pause />}
          {paused ? "Resume" : "Pause"}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label="Repository actions"
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-44">
          <DropdownMenuItem
            disabled={!canReviewAgain(repo)}
            onClick={() => void reviewAgain(taskId, repo.repoPath)}
          >
            Review again
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canDiscardDraft(repo)}
            onClick={() => void discardDraft(taskId, repo.repoPath)}
          >
            Discard draft
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={repo.prNumber === 0 || gone}
            onClick={() => void refreshPR(taskId, repo.repoPath)}
          >
            Refresh PR
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
