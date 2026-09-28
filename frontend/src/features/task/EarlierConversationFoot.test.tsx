import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EarlierConversationFoot } from "@/features/task/EarlierConversationFoot";
import type { TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makePullRequest, makeState, makeStep, makeTask } from "@/test/wails-mock";

function foot(task: TaskSummary, stage: string) {
  return renderWithStore(<EarlierConversationFoot task={task} stage={stage} />, {
    state: makeState({ tasks: [task] }),
    ui: {
      location: { kind: "task", id: task.id },
      earlierConversation: { taskId: task.id, stage, from: null },
    },
  });
}

const ON_STEP_3 = makeTask({
  stage: "implementation",
  currentStep: 3,
  steps: [
    makeStep({ number: 1, status: "done" }),
    makeStep({ number: 2, status: "done" }),
    makeStep({ number: 3, status: "implementing" }),
  ],
});

describe("EarlierConversationFoot", () => {
  it("says which conversation is read, that it takes no more messages, and where the way back goes", () => {
    foot(ON_STEP_3, "step_review:2");

    expect(
      screen.getByText("Step 2 · Reviewer", { selector: "span" }).parentElement,
    ).toHaveTextContent("Step 2 · Reviewer · an earlier conversation. It takes no more messages.");
    expect(screen.getByRole("button", { name: "Back to step 3" })).toBeInTheDocument();
  });

  it.each([
    ["the tech spec", makeTask({ stage: "tech_spec" }), "prd", "PRD"],
    [
      "the implementation",
      makeTask({ mode: "one_shot", stage: "implementation", currentStep: 1 }),
      "one_shot",
      "Planning",
    ],
    [
      "the pull request",
      makeTask({ stage: "pr", pr: makePullRequest({ status: "done", sessionStage: "" }) }),
      "pr_review",
      "PR review",
    ],
  ])("goes back to %s", (target, task, stage, place) => {
    foot(task, stage);

    expect(screen.getByText(place, { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Back to ${target}` })).toBeInTheDocument();
  });

  it("says where the way back goes and its key in the tooltip", async () => {
    const { user } = foot(ON_STEP_3, "step:2");

    await user.hover(screen.getByRole("button", { name: "Back to step 3" }));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Back to where the task is");
    expect(tooltip).toHaveTextContent("Esc");
  });

  it("closes the earlier conversation on Back", async () => {
    const { user } = foot(ON_STEP_3, "step:2");

    await user.click(screen.getByRole("button", { name: "Back to step 3" }));

    expect(useAppStore.getState().earlierConversation).toBeNull();
  });
});
