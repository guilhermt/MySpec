import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskView } from "@/features/task/TaskView";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { SCENES, type SceneName, sceneTask, TASK_ID } from "@/test/task-scenes";

// scene draws the task screen at a moment of the reference task, with its conversations read.
function scene(name: SceneName) {
  const { state, transcripts, openStepTab } = sceneTask(name);
  return renderWithStore(<TaskView taskId={TASK_ID} />, {
    state,
    ui: { location: { kind: "task", id: TASK_ID }, transcripts, openStepTab },
  });
}

const stepper = () => screen.getByRole("list", { name: /^Progress/ });

// The nine scenes of the mock (design/screens/task.md §11), as the stepper and the bar say them.
describe("TaskView, the nine scenes", () => {
  it.each<[SceneName, string, string]>([
    ["plan", "Progress · PRD · waiting for you: waiting for reply in PRD", "wait"],
    ["run", "Progress · Implementation 3/7 · round 1 · Implementer working", "work"],
    [
      "ask",
      "Progress · Implementation 3/7 · pass 2 · waiting for you: question in Reviewer, and 1 more",
      "wait",
    ],
    ["error", "Progress · Implementation 3/7 · pass 2 · error: session error in Reviewer", "error"],
    [
      "manual",
      "Progress · Implementation 4/7 · Manual · waiting for you: review step 4 in Step 4",
      "wait",
    ],
    ["blocked", "Progress · Implementation 5/7 · error: step 5 blocked in Step 5", "error"],
    ["checks", "Progress · PR review · waiting for the checks, 3 of 5 passed", "github"],
    ["findings", "Progress · PR review pass 1 · waiting for you: findings to decide in PR", "wait"],
    ["close", "Progress · Closing · ready to close: ready to close in PR", "close"],
  ])("draws the stepper of the %s scene, with the glyph of its pill", (name, label, glyph) => {
    scene(name);

    expect(stepper()).toHaveAccessibleName(label);
    const pill = within(stepper()).getByRole("listitem", { current: "step" });
    expect(pill.querySelector("[data-state]")).toHaveAttribute("data-state", glyph);
  });

  it.each<SceneName>([...SCENES])("reads no conversation again in the %s scene", (name) => {
    scene(name);

    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("asks for the review of step 4 in the bar of the manual scene", () => {
    scene("manual");

    const bar = screen.getByRole("region", { name: "Request" });
    expect(within(bar).getByRole("status")).toHaveTextContent("Review step 4");
    expect(bar).toHaveTextContent("5 of 7 files staged · 71%");
    expect(within(bar).getByRole("button", { name: "Open in VS Code" })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Approve" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("offers the closing in the bar of the close scene", () => {
    scene("close");

    const bar = screen.getByRole("region", { name: "Request" });
    expect(within(bar).getByRole("status")).toHaveTextContent("Ready to close");
    expect(bar).toHaveTextContent("#1284 merged");
    expect(bar).toHaveTextContent("Removes the worktree and the branch, then updates dev");
    expect(within(bar).getByRole("button", { name: "Close task" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it.each<[SceneName, string]>([
    ["checks", "Pull request #1284"],
    ["findings", "Pull request #1284"],
    ["close", "Pull request #1284"],
  ])("puts the pull request in the ⋯ of the %s scene", async (name, group) => {
    const { user } = scene(name);

    await user.click(screen.getByRole("button", { name: "More actions" }));

    expect(await screen.findByText(group)).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Open PR" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^Refresh PR/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^Review again/ })).toBeInTheDocument();
  });

  it.each<SceneName>(["findings", "close"])(
    "pauses the session of the pull request from the header in the %s scene",
    (name) => {
      scene(name);

      expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    },
  );

  it.each<SceneName>(["plan", "run", "ask", "error", "blocked", "checks", "findings"])(
    "has no request bar in the %s scene",
    (name) => {
      scene(name);

      expect(screen.queryByRole("region", { name: "Request" })).not.toBeInTheDocument();
    },
  );

  it("has no context meter in the checks scene, where no conversation is on screen", () => {
    scene("checks");

    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});
