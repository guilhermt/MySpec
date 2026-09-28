import type { StepperGlyph } from "@/features/task/stepper";
import { stepperOf } from "@/features/task/stepper";
import { baseName, prBaseName } from "@/lib/pull-requests";
import { fallbackReason, stepReportLabel } from "@/lib/review-modes";
import { asLifecycleStage, lifecycleOf, stageLabel } from "@/lib/stages";
import { taskModeLabel } from "@/lib/task-modes";
import type {
  CardIssue,
  Repository,
  ReviewMode,
  Step,
  TaskCard,
  TaskConversation,
  TaskSummary,
} from "@/lib/wails";
import { asReviewFallback, asReviewMode, asStepStatus, asTaskMode, asTaskStage } from "@/lib/wails";

/** DetailsConversation is a row of a conversation; now is the one on screen, not a button. */
export interface DetailsConversation {
  stage: string;
  label: string;
  startedAt: string;
  now: boolean;
}

/** DetailsReport is a row of a review report; file is the artifact name for readArtifact. */
export interface DetailsReport {
  key: string;
  label: string;
  file: string;
  title: string;
}

/** DetailsStepRow is a step in Details: committed, the current one, or not started. */
export type DetailsStepRow =
  | {
      kind: "committed";
      number: number;
      title: string;
      sha: string;
      committedAt: string;
      subject: string;
      conversations: DetailsConversation[];
      reports: DetailsReport[];
    }
  | {
      kind: "current";
      number: number;
      title: string;
      glyph: StepperGlyph;
      mode: "Agent" | "Manual";
      fallbackReason: string;
      reports: DetailsReport[];
    }
  | { kind: "not_started"; step: Step };

/** DetailsModel is what the Details panel of a task lists, group by group. */
export interface DetailsModel {
  /** steps is the Steps group of a Structured task; empty is "Steps come from the plan." before it. */
  steps: { legend: string; rows: DetailsStepRow[]; empty: string | null } | null;
  /** implementation is the Implementation row of a One-Shot task, from the implementation on. */
  implementation: DetailsStepRow | null;
  /** planning is the planning conversations; [] hides the group. */
  planning: DetailsConversation[];
  pullRequest: {
    conversations: DetailsConversation[];
    reports: DetailsReport[];
    pr: { number: number; url: string; base: string; state: string } | null;
  } | null;
  task: {
    repository: string;
    path: string;
    cloneMissing: boolean;
    card: TaskCard | null;
    epic: CardIssue | null;
    mode: string;
    reviewMode: ReviewMode;
    branch: string;
    base: string;
    worktree: string;
    startedAt: string;
  };
}

const PLANNING_STAGES: readonly string[] = ["prd", "tech_spec", "plan", "one_shot"];

function conversationRow(
  conversation: TaskConversation,
  label: string,
  onScreenStage: string | null,
): DetailsConversation {
  return {
    stage: conversation.stage,
    label,
    startedAt: conversation.startedAt,
    now: conversation.stage === onScreenStage,
  };
}

function conversationsOf(task: TaskSummary): TaskConversation[] {
  return task.conversations ?? [];
}

function stepConversations(
  task: TaskSummary,
  number: number,
  onScreenStage: string | null,
): DetailsConversation[] {
  const roles = [
    { stage: `step:${number}`, label: "Implementer" },
    { stage: `step_review:${number}`, label: "Reviewer" },
  ];
  return roles.flatMap(({ stage, label }) =>
    conversationsOf(task)
      .filter((conversation) => conversation.stage === stage)
      .map((conversation) => conversationRow(conversation, label, onScreenStage)),
  );
}

// placeOfStep is how a step is named in front of its reports: "Step 3", or "Implementation" in a One-Shot task.
function placeOfStep(task: TaskSummary, number: number): string {
  return asTaskMode(task.mode) === "one_shot" ? "Implementation" : `Step ${number}`;
}

function stepReports(task: TaskSummary, step: Step): DetailsReport[] {
  return (step.reports ?? []).map((report) => {
    const label = stepReportLabel(report.pass, report.clean);
    return {
      key: `step-${step.number}-${report.pass}`,
      label,
      file: `step-reviews/${report.file}`,
      title: `${placeOfStep(task, step.number)} · ${label}`,
    };
  });
}

function stepRow(task: TaskSummary, step: Step, onScreenStage: string | null): DetailsStepRow {
  if (asStepStatus(step.status) === "done") {
    return {
      kind: "committed",
      number: step.number,
      title: step.title,
      sha: step.commitSha.slice(0, 7),
      committedAt: step.committedAt,
      subject: step.commitSubject,
      conversations: stepConversations(task, step.number, onScreenStage),
      reports: stepReports(task, step),
    };
  }
  if (asTaskStage(task.stage) === "implementation" && step.number === task.currentStep) {
    return {
      kind: "current",
      number: step.number,
      title: step.title,
      // The glyph of the pill does not depend on the clock; only the time of a pause does.
      glyph: stepperOf(task, 0).pill.glyph,
      mode: asReviewMode(step.reviewMode) === "agent" ? "Agent" : "Manual",
      fallbackReason: fallbackReason(asReviewFallback(step.reviewFallback)),
      reports: stepReports(task, step),
    };
  }
  return { kind: "not_started", step };
}

function stepsGroup(task: TaskSummary, onScreenStage: string | null): DetailsModel["steps"] {
  const steps = task.steps ?? [];
  if (steps.length === 0) {
    return { legend: "Steps", rows: [], empty: "Steps come from the plan." };
  }
  const committed = steps.filter((step) => asStepStatus(step.status) === "done").length;
  return {
    legend:
      committed === steps.length
        ? `Steps · ${committed} committed`
        : `Steps · ${committed} of ${steps.length} committed`,
    rows: steps.map((step) => stepRow(task, step, onScreenStage)),
    empty: null,
  };
}

function implementationRow(task: TaskSummary, onScreenStage: string | null): DetailsStepRow | null {
  const stage = asTaskStage(task.stage);
  const [step] = task.steps ?? [];
  if ((stage !== "implementation" && stage !== "pr") || step === undefined) {
    return null;
  }
  return stepRow(task, step, onScreenStage);
}

function planningConversations(
  task: TaskSummary,
  onScreenStage: string | null,
): DetailsConversation[] {
  return lifecycleOf(asTaskMode(task.mode))
    .filter((id) => PLANNING_STAGES.includes(id))
    .flatMap((id) =>
      conversationsOf(task)
        .filter((conversation) => conversation.stage === id)
        .map((conversation) => conversationRow(conversation, stageLabel(id), onScreenStage)),
    );
}

function pullRequestGroup(
  task: TaskSummary,
  onScreenStage: string | null,
): DetailsModel["pullRequest"] {
  const pr = task.pr;
  if (asTaskStage(task.stage) !== "pr" || pr === null) {
    return null;
  }
  const open = pr.prNumber > 0;
  const labels = [
    { stage: "pr", label: open ? `Draft and opening · #${pr.prNumber}` : "Draft and opening" },
    { stage: "pr_review", label: "PR review" },
  ];
  const conversations = labels.flatMap(({ stage, label }) =>
    conversationsOf(task)
      .filter((conversation) => conversation.stage === stage)
      .map((conversation) => conversationRow(conversation, label, onScreenStage)),
  );
  const reports = (pr.reports ?? []).map((report) => {
    const label = stepReportLabel(report.pass, report.clean);
    return {
      key: `pr-${report.pass}`,
      label,
      file: `pr/${report.file}`,
      title: `PR review · ${label}`,
    };
  });
  return {
    conversations,
    reports,
    pr: open
      ? { number: pr.prNumber, url: pr.prUrl, base: prBaseName(pr), state: pr.prState }
      : null,
  };
}

/** detailsOf is the Details panel of a task: Steps or Implementation, Planning, Pull request and Task. */
export function detailsOf(
  task: TaskSummary,
  repository: Repository | null,
  onScreenStage: string | null,
): DetailsModel {
  const oneShot = asTaskMode(task.mode) === "one_shot";
  return {
    steps: oneShot ? null : stepsGroup(task, onScreenStage),
    implementation: oneShot ? implementationRow(task, onScreenStage) : null,
    planning: planningConversations(task, onScreenStage),
    pullRequest: pullRequestGroup(task, onScreenStage),
    task: {
      repository: task.repository,
      path: repository?.path ?? "",
      cloneMissing: repository?.missing ?? false,
      card: task.card,
      epic: task.card?.epic ?? null,
      mode: taskModeLabel(asTaskMode(task.mode)),
      reviewMode: asReviewMode(task.reviewMode),
      branch: task.branch,
      base: baseName(task.baseBranch),
      worktree: task.worktreePath,
      startedAt: task.createdAt,
    },
  };
}

/** earlierPlace is the <Lugar> of an earlier conversation: PRD, Step 2 · Implementer, Draft and opening… */
export function earlierPlace(task: TaskSummary, stage: string): string {
  const step = /^(step|step_review):(\d+)$/.exec(stage);
  if (step !== null) {
    const role = step[1] === "step" ? "Implementer" : "Reviewer";
    return `${placeOfStep(task, Number(step[2]))} · ${role}`;
  }
  if (stage === "pr") {
    return "Draft and opening";
  }
  const id = asLifecycleStage(stage);
  return id === null ? stage : stageLabel(id);
}

/** backTarget is the <agora> of Back to …: step 3, the implementation, the PRD, the pull request… */
export function backTarget(task: TaskSummary, screenStage: string | null): string {
  switch (asTaskStage(task.stage)) {
    case "prd":
      return "the PRD";
    case "tech_spec":
      return "the tech spec";
    case "plan":
      return "the plan";
    case "one_shot":
      return "planning";
    case "implementation":
      return asTaskMode(task.mode) === "one_shot" || task.currentStep === 0
        ? "the implementation"
        : `step ${task.currentStep}`;
    case "pr":
      return screenStage === "pr_review" ? "the PR review" : "the pull request";
  }
}
