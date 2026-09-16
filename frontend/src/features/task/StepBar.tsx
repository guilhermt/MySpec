import { Check, Code, LoaderCircle, RotateCcw, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import { ToneDot } from "@/features/task/StatusDot";
import {
  canApprove,
  canReviewMyself,
  currentStepOf,
  hasStepSession,
  reviewCountLabel,
  stepBarDisplay,
  stepPhaseLabel,
  stepStatusLabel,
} from "@/features/task/step-status";
import { situationTone, stepOrReviewerSituation } from "@/lib/situations";
import {
  asReviewFallback,
  asReviewMode,
  asStepStatus,
  type Step,
  type StepStatus,
  type TaskSummary,
} from "@/lib/wails";
import { approveStep, openInEditor, reviewStepMyself } from "@/store/actions";

// The states where the review of the step is what the bar is about.
const REVIEW_STATES: readonly StepStatus[] = [
  "awaiting_review",
  "in_review",
  "ready_to_approve",
  "nothing_to_commit",
  "review_failed",
];

/** approveHint says what is missing before the step can be approved. */
function approveHint(status: StepStatus): string {
  switch (status) {
    case "nothing_to_commit":
      return "The agent didn't change anything";
    case "review_failed":
      return "The worktree couldn't be read";
    default:
      return "Stage every changed file in VS Code to approve";
  }
}

/**
 * stateText reads the state of the step, with the count while it is reviewed.
 * The bar spells the progress out in files; the percentage is what the list of
 * tasks shows, where there is no room for the count.
 */
function stateText(step: Step, label: string): string {
  const review = step.review;
  if (review === null || review.error !== "" || review.total === 0) {
    return label;
  }
  return `${label} · ${reviewCountLabel(review)}`;
}

export interface StepBarProps {
  task: TaskSummary;
}

/** StepBar names the step being implemented and holds what can be done to it. */
export function StepBar({ task }: StepBarProps) {
  const [discarding, setDiscarding] = useState(false);

  const step = currentStepOf(task);
  if (step === null) {
    return null;
  }

  const display = stepBarDisplay(task, step);
  // The step waits on the user in its own conversation or in the one of its
  // reviewer, whichever tab is on screen.
  const situation = stepOrReviewerSituation(task, step.number);
  // What waits on the user takes the colour of its situation; without one, the
  // dot shows the step and the conversation it waits on.
  const tone = situation !== null ? situationTone(situation) : display.tone;
  const status = asStepStatus(step.status);
  const preparing = status === "preparing";
  const committing = status === "committing";
  const reviewing = REVIEW_STATES.includes(status);
  // Under the agent review nobody approves: the agent commits after a clean report.
  const agent = asReviewMode(step.reviewMode) === "agent";
  // The worktree is only there once it has been created.
  const canOpen = step.worktreePath !== "";

  const openButton = (
    <Button
      variant="outline"
      size="sm"
      disabled={!canOpen}
      onClick={() => void openInEditor(task.id)}
    >
      <Code />
      Open in VS Code
    </Button>
  );

  const approveButton = (
    <Button
      variant="default"
      size="sm"
      disabled={!canApprove(step)}
      onClick={() => void approveStep(task.id)}
    >
      {committing ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Check />}
      Approve
    </Button>
  );

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <span className="text-xs text-muted-foreground tabular-nums">
        {`Step ${step.number} of ${(task.steps ?? []).length}`}
      </span>
      <span className="min-w-0 truncate font-medium">{step.title}</span>
      <span
        role="status"
        aria-live="polite"
        className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        {preparing ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            {stepPhaseLabel(step.phase)}
          </>
        ) : (
          <>
            <ToneDot tone={tone} />
            {stateText(step, reviewing ? stepStatusLabel(step) : display.label)}
          </>
        )}
      </span>
      {step.commitFailed && (
        <span className="shrink-0 text-xs text-muted-foreground">
          The last approval didn't produce a commit.
        </span>
      )}
      {asReviewFallback(step.reviewFallback) === "rounds_exhausted" && reviewing && (
        <span className="shrink-0 text-xs text-muted-foreground">
          The agent review didn't come clean after three rounds.
        </span>
      )}

      <span className="flex-1" />

      {!agent &&
        (reviewing || committing) &&
        (canApprove(step) || committing ? (
          approveButton
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span />}>{approveButton}</TooltipTrigger>
            <TooltipContent>{approveHint(status)}</TooltipContent>
          </Tooltip>
        ))}
      {canReviewMyself(step) && (
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="default" size="sm" />}
            onClick={() => void reviewStepMyself(task.id)}
          >
            <UserRoundCheck />
            Review myself
          </TooltipTrigger>
          <TooltipContent>Stop the agent review and review this step yourself</TooltipContent>
        </Tooltip>
      )}

      {canOpen ? (
        openButton
      ) : (
        <Tooltip>
          <TooltipTrigger render={<span />}>{openButton}</TooltipTrigger>
          <TooltipContent>The worktree doesn't exist yet</TooltipContent>
        </Tooltip>
      )}
      {hasStepSession(step) && (
        <Button variant="ghost" size="sm" onClick={() => setDiscarding(true)}>
          <RotateCcw />
          Discard step
        </Button>
      )}

      <DiscardStepDialog task={task} step={step} open={discarding} onOpenChange={setDiscarding} />
    </div>
  );
}
