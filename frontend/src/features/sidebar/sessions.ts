import { currentStepOf, hasStepSession, stepStage } from "@/features/task/step-status";
import type { DiscussionSummary, ReviewSummary, SessionStatus, TaskSummary } from "@/lib/wails";
import { asSessionStatus, asTaskStage } from "@/lib/wails";

/** ItemSession is one conversation of an item: who it is, how it is and what it runs now. */
export interface ItemSession {
  /** role is who speaks in it: Implementer, Reviewer, PRD agent, Tech spec agent, Plan agent, Planning agent, PR agent or Discussion agent. */
  role: string;
  stage: string;
  status: SessionStatus;
  /** working is the session being in a turn or starting one (sessionStatus working). */
  working: boolean;
  turnRunning: boolean;
  processRunning: boolean;
  retryAttempt: number;
  contextPercent: number;
  turnStartedAt: string;
  actionLabel: string;
  actionTarget: string;
}

/** SessionBlock is the part of a DTO that tells the state of a session. */
interface SessionBlock {
  sessionStatus: string;
  turnRunning: boolean;
  processRunning: boolean;
  retryAttempt: number;
  contextPercent: number;
  turnStartedAt: string;
  actionLabel: string;
  actionTarget: string;
}

function itemSession(role: string, stage: string, block: SessionBlock): ItemSession {
  const status = asSessionStatus(block.sessionStatus);
  return {
    role,
    stage,
    status,
    working: status === "working",
    turnRunning: block.turnRunning,
    processRunning: block.processRunning,
    retryAttempt: block.retryAttempt,
    contextPercent: block.contextPercent,
    turnStartedAt: block.turnStartedAt,
    actionLabel: block.actionLabel,
    actionTarget: block.actionTarget,
  };
}

/** taskSessions is every conversation the task has in the stage it is in. */
export function taskSessions(task: TaskSummary): ItemSession[] {
  switch (asTaskStage(task.stage)) {
    case "prd":
      return [itemSession("PRD agent", task.stage, task)];
    case "tech_spec":
      return [itemSession("Tech spec agent", task.stage, task)];
    case "plan":
      return [itemSession("Plan agent", task.stage, task)];
    case "one_shot":
      return [itemSession("Planning agent", task.stage, task)];
    case "implementation": {
      const step = currentStepOf(task);
      const sessions: ItemSession[] = [];
      if (step !== null && hasStepSession(step)) {
        sessions.push(itemSession("Implementer", stepStage(step.number), task));
      }
      if (step?.reviewer) {
        sessions.push(itemSession("Reviewer", step.reviewer.sessionStage, step.reviewer));
      }
      return sessions;
    }
    case "pr":
      return task.pr && task.pr.sessionStage !== ""
        ? [itemSession("PR agent", task.pr.sessionStage, task.pr)]
        : [];
  }
}

/** reviewSessions is the conversation of a review, once it opened. */
export function reviewSessions(review: ReviewSummary): ItemSession[] {
  return review.sessionStage === "" ? [] : [itemSession("Reviewer", review.sessionStage, review)];
}

/** discussionSessions is the conversation of a discussion, once it opened. */
export function discussionSessions(discussion: DiscussionSummary): ItemSession[] {
  return discussion.sessionStage === ""
    ? []
    : [itemSession("Discussion agent", discussion.sessionStage, discussion)];
}

/**
 * workingSession is the working session whose turn started first, null when none works. A turn that
 * has not told its start yet counts as starting at now.
 */
export function workingSession(sessions: readonly ItemSession[], now: number): ItemSession | null {
  let first: ItemSession | null = null;
  let firstAt = Infinity;
  for (const session of sessions) {
    if (!session.working) {
      continue;
    }
    const at = session.turnStartedAt === "" ? now : Date.parse(session.turnStartedAt);
    if (first === null || at < firstAt) {
      first = session;
      firstAt = at;
    }
  }
  return first;
}
