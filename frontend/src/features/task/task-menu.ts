import type { IconMeaning } from "@/components/system/icons";
import { canDiscardDraft, reviewAgainRefusal } from "@/features/task/pr-status";
import { type StageAction, stageNoun } from "@/features/task/stage-actions";
import { canReviewMyself, currentStepOf, hasStepSession } from "@/features/task/step-status";
import { reviewModeLabel } from "@/lib/review-modes";
import { type LifecycleStage, lifecycleOf, stageIndex, stageLabel } from "@/lib/stages";
import type { PullRequest, TaskMode, TaskStage, TaskSummary } from "@/lib/wails";
import { asPRStatus, asReviewMode, asTaskMode, asTaskStage } from "@/lib/wails";
import { age } from "@/lib/when";

/** TaskMenuAction is what an item of the ⋯ of a task does. */
export type TaskMenuAction =
  | { kind: "reviewMyself" }
  | { kind: "openInEditor" }
  | { kind: "discardStep" }
  | { kind: "discardDraft" }
  | { kind: "openPR" }
  | { kind: "refreshPR" }
  | { kind: "reviewAgain" }
  | { kind: "reviewModePopover" }
  | { kind: "modelsPopover" }
  | { kind: "stage"; action: StageAction; stage: TaskStage }
  | { kind: "deleteTask" };

/** TaskMenuItem is one item of the ⋯ of a task. */
export interface TaskMenuItem {
  /** id is a stable key: "step.openInEditor", "task.back.prd". */
  id: string;
  /** label is "Discard step 4…", "Back to PRD…", "Review mode". */
  label: string;
  action: TaskMenuAction;
  icon?: IconMeaning;
  /** shortcut is "Ctrl+E". */
  shortcut?: string;
  /** sub is the hint beside the label: "Agent", "Manual", "per stage". */
  sub?: string;
  /** opensPopover draws the ›. */
  opensPopover?: boolean;
  /** tooltip is "Read the pull request now · checked 2m ago". */
  tooltip?: string;
  /** disabledReason is why the item can't be chosen: "the worktree doesn't exist yet". */
  disabledReason?: string;
  destructive?: boolean;
}

/** TaskMenuGroup is a group of the ⋯; a null label is the group after the separator. */
export interface TaskMenuGroup {
  label: string | null;
  items: TaskMenuItem[];
}

/** StageMenuItem is a control over a stage, ready to be confirmed: what to do and what to do it to. */
export interface StageMenuItem {
  action: StageAction;
  stage: TaskStage;
  label: string;
}

function discardItem(stage: TaskStage): StageMenuItem {
  return { action: "discard", stage, label: "Discard and restart" };
}

function backItem(stage: TaskStage): StageMenuItem {
  return { action: "back", stage, label: `Back to ${stageNoun(stage)}` };
}

/**
 * menuItems is what a stage offers: reopening a finished PRD, tech spec or One-Shot planning, and
 * starting any planning stage over. Every other stage offers nothing. Its only caller, taskGroup,
 * never asks about the current stage itself.
 */
export function menuItems(mode: TaskMode, current: TaskStage, id: LifecycleStage): StageMenuItem[] {
  if (id === "one_shot") {
    return [backItem("one_shot"), discardItem("one_shot")];
  }
  if (id === "prd" && current !== "prd") {
    return [backItem("prd"), discardItem("prd")];
  }
  if (id === "tech_spec" && stageIndex(mode, current) > stageIndex(mode, "tech_spec")) {
    return [backItem("tech_spec"), discardItem("tech_spec")];
  }
  if (id === "plan" && current === "implementation") {
    return [discardItem("plan")];
  }
  return [];
}

// stageItemLabel is how the ⋯ names a control over a stage: "Back to PRD…", "Discard and restart the plan…".
function stageItemLabel(item: StageMenuItem): string {
  if (item.stage === "one_shot") {
    return item.action === "back" ? "Back to planning…" : "Discard and restart planning…";
  }
  return item.action === "back"
    ? `Back to ${stageLabel(item.stage)}…`
    : `Discard and restart the ${stageNoun(item.stage)}…`;
}

function stageMenuItem(item: StageMenuItem): TaskMenuItem {
  return {
    id: `task.${item.action}.${item.stage}`,
    label: stageItemLabel(item),
    action: { kind: "stage", action: item.action, stage: item.stage },
  };
}

function openInEditor(id: string, disabledReason?: string): TaskMenuItem {
  return {
    id,
    label: "Open in VS Code",
    action: { kind: "openInEditor" },
    icon: "openInEditor",
    shortcut: "Ctrl+E",
    ...(disabledReason === undefined ? {} : { disabledReason }),
  };
}

function stepGroup(task: TaskSummary): TaskMenuGroup | null {
  const step = asTaskStage(task.stage) === "implementation" ? currentStepOf(task) : null;
  if (step === null) {
    return null;
  }
  const oneShot = asTaskMode(task.mode) === "one_shot";
  const items: TaskMenuItem[] = [];
  if (canReviewMyself(step)) {
    items.push({
      id: "step.reviewMyself",
      label: "Review myself",
      action: { kind: "reviewMyself" },
    });
  }
  items.push(
    openInEditor(
      "step.openInEditor",
      task.worktreePath === "" ? "the worktree doesn't exist yet" : undefined,
    ),
  );
  if (hasStepSession(step)) {
    items.push({
      id: "step.discard",
      label: oneShot ? "Discard the implementation…" : `Discard step ${step.number}…`,
      action: { kind: "discardStep" },
    });
  }
  return { label: oneShot ? "Implementation" : `Step ${step.number} · ${step.title}`, items };
}

function draftGroup(pr: PullRequest): TaskMenuGroup {
  const items: TaskMenuItem[] = [];
  if (canDiscardDraft(pr)) {
    items.push({ id: "draft.discard", label: "Discard draft", action: { kind: "discardDraft" } });
  }
  if (pr.worktreePath !== "") {
    items.push(openInEditor("draft.openInEditor"));
  }
  return { label: "Pull request", items };
}

function pullRequestGroup(pr: PullRequest, now: number): TaskMenuGroup {
  const closing = asPRStatus(pr.status) === "closing";
  const checked = age(pr.checkedAt, now);
  const refusal = reviewAgainRefusal(pr);
  const items: TaskMenuItem[] = [
    { id: "pr.open", label: "Open PR", action: { kind: "openPR" }, icon: "external" },
    {
      id: "pr.refresh",
      label: "Refresh PR",
      action: { kind: "refreshPR" },
      tooltip:
        checked === ""
          ? "Read the pull request now"
          : `Read the pull request now · checked ${checked}`,
      ...(closing ? { disabledReason: "the task is closing" } : {}),
    },
    {
      id: "pr.reviewAgain",
      label: "Review again",
      action: { kind: "reviewAgain" },
      ...(refusal === null ? {} : { disabledReason: refusal }),
    },
  ];
  if (pr.worktreePath !== "" && !closing) {
    items.push(openInEditor("pr.openInEditor"));
  }
  return { label: `Pull request #${pr.prNumber}`, items };
}

function prGroup(task: TaskSummary, now: number): TaskMenuGroup | null {
  const pr = task.pr;
  if (asTaskStage(task.stage) !== "pr" || pr === null) {
    return null;
  }
  return pr.prNumber > 0 ? pullRequestGroup(pr, now) : draftGroup(pr);
}

function planningGroup(task: TaskSummary): TaskMenuGroup | null {
  const stage = asTaskStage(task.stage);
  if (stage === "implementation" || stage === "pr") {
    return null;
  }
  return { label: stageLabel(stage), items: [stageMenuItem(discardItem(stage))] };
}

function taskGroup(task: TaskSummary): TaskMenuGroup {
  const mode = asTaskMode(task.mode);
  const current = asTaskStage(task.stage);
  // The current planning stage is started over from its own group.
  const stages = lifecycleOf(mode)
    .filter((id) => id !== current)
    .flatMap((id) => menuItems(mode, current, id))
    .map(stageMenuItem);
  return {
    label: "Task",
    items: [
      {
        id: "task.reviewMode",
        label: "Review mode",
        action: { kind: "reviewModePopover" },
        sub: reviewModeLabel(asReviewMode(task.reviewMode)),
        opensPopover: true,
      },
      {
        id: "task.models",
        label: "Models",
        action: { kind: "modelsPopover" },
        sub: "per stage",
        opensPopover: true,
      },
      ...stages,
    ],
  };
}

/** taskMenuOf is the ⋯ of a task: the groups by subject, each only with items, the destructive last. */
export function taskMenuOf(task: TaskSummary, now: number): TaskMenuGroup[] {
  const groups = [stepGroup(task), prGroup(task, now), planningGroup(task), taskGroup(task)];
  return [
    ...groups.filter((group): group is TaskMenuGroup => group !== null && group.items.length > 0),
    {
      label: null,
      items: [
        {
          id: "task.delete",
          label: "Delete task…",
          action: { kind: "deleteTask" },
          destructive: true,
        },
      ],
    },
  ];
}
