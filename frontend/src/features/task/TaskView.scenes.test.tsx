import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskView } from "@/features/task/TaskView";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { fixSceneClock, SCENES, type SceneName, sceneTask, TASK_ID } from "@/test/task-scenes";

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
// The scenes are drawn at the moment of the mock, whatever the day the suite runs.
fixSceneClock();

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
    ["blocked", "Progress · Implementation 5/7 · error: step 5 blocked", "error"],
    ["checks", "Progress · PR review · waiting for the checks, 3 of 5 passed", "github"],
    [
      "findings",
      "Progress · PR review pass 1 · waiting for you: decide findings in PR review",
      "wait",
    ],
    ["close", "Progress · Closing · ready to close: ready to close in PR", "close"],
  ])("draws the stepper of the %s scene, with the glyph of its pill", (name, label, glyph) => {
    scene(name);

    expect(stepper()).toHaveAccessibleName(label);
    const pill = within(stepper()).getByRole("listitem", { current: "step" });
    expect(pill.querySelector("[data-state]")).toHaveAttribute("data-state", glyph);
  });

  it.each<[SceneName, "Implementer" | "Reviewer", string]>([
    ["run", "Implementer", "ImplementerReviewer"],
    ["ask", "Reviewer", "Implementer· waitsReviewer"],
    ["error", "Reviewer", "ImplementerReviewer"],
  ])("puts the agent tabs of the %s scene on the %s", (name, chosen, text) => {
    scene(name);

    const tablist = screen.getByRole("tablist", { name: "Conversations" });
    expect(tablist).toHaveTextContent(text, { normalizeWhitespace: true });
    expect(within(tablist).getByRole("tab", { selected: true })).toHaveAccessibleName(
      new RegExp(`^${chosen}: `),
    );
  });

  it.each<SceneName>(["plan", "manual", "blocked", "checks", "findings", "close"])(
    "has no agent tabs in the %s scene",
    (name) => {
      scene(name);

      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    },
  );

  it.each<SceneName>([...SCENES])("reads no conversation again in the %s scene", (name) => {
    scene(name);

    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("asks for the review of step 4 in the bar of the manual scene", () => {
    scene("manual");

    const bar = screen.getByRole("region", { name: "Request" });
    expect(bar).toHaveTextContent("Review step 4");
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
    expect(bar).toHaveTextContent("Ready to close");
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

  it.each<[SceneName, string]>([
    ["plan", "Waiting for reply· PRD"],
    ["ask", "Question· Reviewer"],
    ["error", "Session error· Reviewer"],
    ["blocked", "Step 5 blocked· worktree not clean"],
    ["findings", "Decide findings· PR review"],
  ])("draws the bar of the %s scene", (name, label) => {
    scene(name);

    expect(screen.getByRole("region", { name: "Request" })).toHaveTextContent(label);
  });

  it.each<[SceneName, string]>([
    ["plan", "2m"],
    ["ask", "18m"],
    ["error", "5m"],
    ["manual", "9m"],
    ["blocked", "6m"],
    ["findings", "12m"],
    ["close", "2h"],
  ])("says in the chip of the %s scene how long it waited, as the mock does", (name, wait) => {
    scene(name);

    expect(screen.getByRole("region", { name: "Request" })).toHaveTextContent(wait);
  });

  it("offers the options of the question in text of the plan scene as quick replies", () => {
    scene("plan");

    const replies = screen.getByRole("group", { name: "Quick replies" });
    expect(
      within(replies)
        .getAllByRole("button")
        .map((reply) => reply.textContent),
    ).toEqual(["aPlans table, cached 60 s", "bConfig, with a release"]);
  });

  it("says how long the turn of the run scene has run", () => {
    scene("run");

    expect(screen.getByText("Working · 3m 40s")).toBeInTheDocument();
  });

  it("retries the reviewer whose session stopped in the error scene", () => {
    scene("error");

    const bar = screen.getByRole("region", { name: "Request" });
    expect(within(bar).getByRole("button", { name: "Retry reviewer" })).toBeInTheDocument();
    expect(screen.getByText("Claude Code stopped unexpectedly.")).toBeInTheDocument();
    expect(screen.queryByText("The agent couldn't finish the turn.")).not.toBeInTheDocument();
  });

  it("lists the seven changed files of step 4 in the manual scene", () => {
    scene("manual");

    const card = screen.getByRole("article", { name: /^Changed files · 7/ });
    expect(within(card).getAllByRole("listitem")).toHaveLength(7);
  });

  it("ends the conversation of the close scene with the merge", () => {
    scene("close");

    expect(
      screen.getByRole("article", { name: /^Merged #1284 into dev · by lnakamura/ }),
    ).toBeInTheDocument();
  });

  it.each<SceneName>(["run", "checks"])("has no request bar in the %s scene", (name) => {
    scene(name);

    expect(screen.queryByRole("region", { name: "Request" })).not.toBeInTheDocument();
  });

  it("has no context meter in the checks scene, where no conversation is on screen", () => {
    scene("checks");

    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});
