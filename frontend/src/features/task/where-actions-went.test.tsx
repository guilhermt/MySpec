import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskView } from "@/features/task/TaskView";
import type { Situation, Step, TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReview, makeSituation, makeState, makeStep, makeTask } from "@/test/wails-mock";

const WORKTREE = "/w/api/add-login";

// inStep is the task implementing its first step, waiting on its own conversation.
function inStep(step: Partial<Step>, overrides: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    stage: "implementation",
    currentStep: 1,
    worktreePath: WORKTREE,
    steps: [makeStep({ worktreePath: WORKTREE, ...step })],
    ...overrides,
  });
}

function stepSituation(kind: string, form = ""): Situation {
  return makeSituation({ kind, form, place: { kind: "step", stage: "", step: 1 } });
}

const REVIEWING = makeReview({ staged: 2, total: 2, percent: 100 });

/** Row is a button of a bar that left, in a state it appeared in, and where it is now. */
interface Row {
  origin: "StepBar" | "StageTrack";
  button: string;
  state: string;
  task: TaskSummary;
  where: "menu" | "bar";
  /** name is the accessible name in the new place. */
  name: RegExp;
  disabled?: boolean;
}

const ROWS: Row[] = [
  {
    origin: "StepBar",
    button: "Open in VS Code",
    state: "implementing",
    task: inStep({ status: "implementing" }),
    where: "menu",
    name: /^Open in VS Code/,
  },
  {
    origin: "StepBar",
    button: "Open in VS Code",
    state: "before the worktree exists",
    task: inStep({ status: "preparing", worktreePath: "" }, { worktreePath: "" }),
    where: "menu",
    name: /^Open in VS Code · the worktree doesn't exist yet/,
    disabled: true,
  },
  {
    origin: "StepBar",
    button: "Open in VS Code",
    state: "awaiting review",
    task: inStep(
      { status: "awaiting_review", review: makeReview() },
      { situations: [stepSituation("step_review", "review")] },
    ),
    where: "bar",
    name: /^Open in VS Code$/,
  },
  {
    origin: "StepBar",
    button: "Approve",
    state: "awaiting review, files left to stage",
    task: inStep(
      { status: "awaiting_review", review: makeReview() },
      { situations: [stepSituation("step_review", "review")] },
    ),
    where: "bar",
    name: /^Approve$/,
    disabled: true,
  },
  {
    origin: "StepBar",
    button: "Approve",
    state: "ready to approve",
    task: inStep(
      { status: "ready_to_approve", review: REVIEWING },
      { situations: [stepSituation("step_review", "approve")] },
    ),
    where: "bar",
    name: /^Approve$/,
  },
  {
    origin: "StepBar",
    button: "Approve",
    state: "the worktree unreadable",
    task: inStep(
      { status: "review_failed", review: makeReview({ error: "git status failed" }) },
      { situations: [stepSituation("step_review", "review")] },
    ),
    where: "bar",
    name: /^Approve$/,
    disabled: true,
  },
  {
    origin: "StepBar",
    button: "Approve",
    state: "ready to approve, the task paused",
    task: inStep({ status: "ready_to_approve", review: REVIEWING }, { sessionStatus: "paused" }),
    where: "bar",
    name: /^Approve$/,
  },
  {
    origin: "StepBar",
    button: "Approve",
    state: "nothing to commit",
    task: inStep({ status: "nothing_to_commit" }, { situations: [stepSituation("step_empty")] }),
    where: "bar",
    name: /^Discard step 1…$/,
  },
  {
    origin: "StepBar",
    button: "Review myself",
    state: "agent review",
    task: inStep({ status: "agent_review", reviewMode: "agent" }),
    where: "menu",
    name: /^Review myself$/,
  },
  {
    origin: "StepBar",
    button: "Discard step",
    state: "implementing",
    task: inStep({ status: "implementing" }),
    where: "menu",
    name: /^Discard step 1…$/,
  },
  {
    origin: "StageTrack",
    button: "Discard and restart",
    state: "in the PRD",
    task: makeTask({ stage: "prd" }),
    where: "menu",
    name: /^Discard and restart the PRD…$/,
  },
  {
    origin: "StageTrack",
    button: "Back to PRD",
    state: "in the tech spec",
    task: makeTask({ stage: "tech_spec" }),
    where: "menu",
    name: /^Back to PRD…$/,
  },
  {
    origin: "StageTrack",
    button: "Discard and restart",
    state: "the PRD, in the tech spec",
    task: makeTask({ stage: "tech_spec" }),
    where: "menu",
    name: /^Discard and restart the PRD…$/,
  },
  {
    origin: "StageTrack",
    button: "Back to tech spec",
    state: "in the plan",
    task: makeTask({ stage: "plan" }),
    where: "menu",
    name: /^Back to Tech spec…$/,
  },
  {
    origin: "StageTrack",
    button: "Discard and restart",
    state: "the plan, in the implementation",
    task: inStep({ status: "implementing" }),
    where: "menu",
    name: /^Discard and restart the plan…$/,
  },
  {
    origin: "StageTrack",
    button: "Discard and restart",
    state: "in the One-Shot planning",
    task: makeTask({ mode: "one_shot", stage: "one_shot" }),
    where: "menu",
    name: /^Discard and restart planning…$/,
  },
  {
    origin: "StageTrack",
    button: "Back to planning",
    state: "a One-Shot in the implementation",
    task: inStep({ status: "implementing" }, { mode: "one_shot" }),
    where: "menu",
    name: /^Back to planning…$/,
  },
  {
    origin: "StageTrack",
    button: "Back to planning",
    state: "a One-Shot in the PR",
    task: makeTask({ mode: "one_shot", stage: "pr" }),
    where: "menu",
    name: /^Back to planning…$/,
  },
  {
    origin: "StageTrack",
    button: "Continue to tech spec",
    state: "the PRD revisited",
    task: makeTask({
      stage: "prd",
      revisiting: true,
      canContinue: true,
      situations: [
        makeSituation({
          kind: "ready_to_continue",
          place: { kind: "stage", stage: "prd", step: 0 },
        }),
      ],
    }),
    where: "bar",
    name: /^Continue$/,
  },
];

describe("where the actions of the bars that left went", () => {
  it.each(ROWS)(
    "$origin: $button, $state, is in the $where",
    async ({ task, where, name, disabled }) => {
      const { user } = renderWithStore(<TaskView taskId={task.id} />, {
        state: makeState({ tasks: [task] }),
        ui: { location: { kind: "task", id: task.id } },
      });

      let found: HTMLElement;
      if (where === "menu") {
        await user.click(screen.getByRole("button", { name: "More actions" }));
        found = await screen.findByRole("menuitem", { name });
      } else {
        found = within(screen.getByRole("region", { name: "Request" })).getByRole("button", {
          name,
        });
      }

      if (disabled) {
        expect(found).toHaveAttribute("aria-disabled", "true");
      } else {
        expect(found).not.toHaveAttribute("aria-disabled", "true");
      }
    },
  );
});
