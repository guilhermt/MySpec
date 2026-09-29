import type { SessionState } from "@/features/chat/session";
import { taskSessions } from "@/features/sidebar/sessions";
import { stageNoun } from "@/features/task/stage-actions";
import { currentStepOf, hasStepSession, loopSession, stepStage } from "@/features/task/step-status";
import { lowerFirst } from "@/lib/situations";
import type { Step, StepReviewer, TaskSummary } from "@/lib/wails";
import { asPRStatus, asSessionStatus, asTaskStage } from "@/lib/wails";
import type { StepTab } from "@/store/app-store";

/** TaskSession is a session of a task seen from its screen: where it talks, who talks, and its state. */
export interface TaskSession extends SessionState {
  /** stage is the session stage: prd, step:<n>, step_review:<n>, pr, pr_review… */
  stage: string;
  /** role is who talks: Implementer, Reviewer, PRD agent, Tech spec agent, Plan agent, Planning agent, PR agent. */
  role: string;
  contextPercent: number;
}

/** SessionBlock is the part of a DTO that tells the state of a session. */
type SessionBlock = SessionState & { contextPercent: number };

function sessionOf(task: TaskSummary, stage: string, block: SessionBlock): TaskSession {
  // The name of each conversation is the one the sidebar gives it, so the app has one.
  const role = taskSessions(task).find((session) => session.stage === stage)?.role ?? "";
  return {
    stage,
    role,
    sessionStatus: block.sessionStatus,
    sessionModel: block.sessionModel,
    sessionEffort: block.sessionEffort,
    turnRunning: block.turnRunning,
    processRunning: block.processRunning,
    retryAttempt: block.retryAttempt,
    retryMax: block.retryMax,
    retryAt: block.retryAt,
    retryReason: block.retryReason,
    turnStartedAt: block.turnStartedAt,
    lastError: block.lastError,
    turnFailed: block.turnFailed,
    contextPercent: block.contextPercent,
    pausedAt: block.pausedAt,
  };
}

function implementerOf(task: TaskSummary, step: Step): TaskSession {
  return sessionOf(task, stepStage(step.number), task);
}

function reviewerOf(task: TaskSummary, reviewer: StepReviewer): TaskSession {
  return sessionOf(task, reviewer.sessionStage, reviewer);
}

/**
 * waitingSession is the conversation the task waits on: the planning stage's; in a step, the reviewer's
 * in agent_review and the implementer's in the rest, only with a session; in the PR, pr.sessionStage's.
 * Null when there is none.
 */
export function waitingSession(task: TaskSummary): TaskSession | null {
  switch (asTaskStage(task.stage)) {
    case "prd":
    case "tech_spec":
    case "plan":
    case "one_shot":
      return sessionOf(task, task.stage, task);
    case "implementation": {
      const step = currentStepOf(task);
      if (step === null || !hasStepSession(step)) {
        return null;
      }
      const loop = loopSession(task, step);
      return step.reviewer !== null && loop.stage === step.reviewer.sessionStage
        ? reviewerOf(task, step.reviewer)
        : implementerOf(task, step);
    }
    case "pr": {
      const pr = task.pr;
      return pr === null || pr.sessionStage === "" ? null : sessionOf(task, pr.sessionStage, pr);
    }
  }
}

/**
 * screenSession is the conversation on screen: the chosen tab's in a step with both, else
 * waitingSession; null without a session on screen (step blocked or preparing, PR waiting for checks
 * without a conversation, PR done or merged).
 */
export function screenSession(task: TaskSummary, tab: StepTab): TaskSession | null {
  if (task.pr !== null && asTaskStage(task.stage) === "pr") {
    const status = asPRStatus(task.pr.status);
    if (status === "done" || status === "merged") {
      return null;
    }
  }
  const step = asTaskStage(task.stage) === "implementation" ? currentStepOf(task) : null;
  if (step !== null && hasStepSession(step) && step.reviewer !== null) {
    return tab === "reviewer" ? reviewerOf(task, step.reviewer) : implementerOf(task, step);
  }
  return waitingSession(task);
}

/** isPaused is whether the task is paused: waitingSession exists and its sessionStatus is paused. */
export function isPaused(task: TaskSummary): boolean {
  const session = waitingSession(task);
  return session !== null && asSessionStatus(session.sessionStatus) === "paused";
}

/** speaker is who talks in a session inside a sentence: implementer, reviewer, PRD agent, tech spec agent. */
export function speaker(session: TaskSession): string {
  return lowerFirst(session.role);
}

/**
 * pauseRefusal is why Pause can't act on the session the task waits on: it stopped with an error,
 * so nothing runs. Null when it can.
 */
export function pauseRefusal(task: TaskSummary, session: TaskSession): string | null {
  if (asSessionStatus(session.sessionStatus) !== "error") {
    return null;
  }
  const stage = asTaskStage(task.stage);
  const way =
    stage === "implementation"
      ? ", or discard the step."
      : stage === "pr"
        ? "."
        : `, or discard and restart ${stage === "one_shot" ? "planning" : `the ${stageNoun(stage)}`}.`;
  return `Nothing is running to pause: the ${speaker(session)}'s session stopped with an error. Retry it${way}`;
}

/** contextDetail is the tooltip of the meter: "Context used by the implementer: 44%", "…" before the first reading. */
export function contextDetail(session: TaskSession): string {
  const used = session.contextPercent === 0 ? "…" : `${Math.round(session.contextPercent)}%`;
  return `Context used by the ${speaker(session)}: ${used}`;
}
