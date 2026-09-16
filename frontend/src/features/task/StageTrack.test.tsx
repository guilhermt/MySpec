import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageTrack } from "@/features/task/StageTrack";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeTask } from "@/test/wails-mock";

function track(overrides: Partial<TaskSummary> = {}) {
  const task = makeTask(overrides);
  return renderWithStore(<StageTrack task={task} />, { state: makeState({ tasks: [task] }) });
}

async function openMenu(user: ReturnType<typeof track>["user"], chip: string) {
  await user.click(screen.getByRole("button", { name: chip }));
  return screen.findByRole("menu");
}

describe("StageTrack", () => {
  it("shows the whole lifecycle, including what the product does not drive yet", () => {
    track();

    for (const label of ["PRD", "Tech spec", "Plan", "Implementation", "PR review", "Closing"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the stages the task went through and the one it is in", () => {
    track({ stage: "plan" });

    expect(screen.getByRole("button", { name: "PRD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tech spec" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Implementation" })).not.toBeInTheDocument();
  });

  it("says when the stage the task is in was reopened", () => {
    track({ revisiting: true });

    expect(screen.getByRole("button", { name: "PRD · revisiting" })).toBeInTheDocument();
  });

  it("offers only a restart on the stage the task is in", async () => {
    const { user } = track();

    const menu = await openMenu(user, "PRD");

    expect(menu).toHaveTextContent("Discard and restart");
    expect(screen.queryByRole("menuitem", { name: "Back to PRD" })).not.toBeInTheDocument();
  });

  it("offers going back to a stage that is done", async () => {
    const { user } = track({ stage: "tech_spec" });

    await openMenu(user, "PRD");

    expect(screen.getByRole("menuitem", { name: "Back to PRD" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Discard and restart" })).toBeInTheDocument();
  });

  it("has no way back to the plan, only a restart", async () => {
    const { user } = track({ stage: "implementation" });

    const menu = await openMenu(user, "Plan");

    expect(menu).toHaveTextContent("Discard and restart");
    expect(screen.queryByRole("menuitem", { name: "Back to plan" })).not.toBeInTheDocument();
  });

  it("reopens a stage after the confirmation", async () => {
    const { user } = track({ stage: "plan" });

    await openMenu(user, "Tech spec");
    await user.click(screen.getByRole("menuitem", { name: "Back to tech spec" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Back to the Tech spec?");
    expect(dialog).toHaveTextContent("This deletes the plan conversation and the step files.");

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(api.backToStage).toHaveBeenCalledWith("task-1", "tech_spec");
  });

  it("restarts a stage after the confirmation", async () => {
    const { user } = track({ stage: "tech_spec" });

    await openMenu(user, "Tech spec");
    await user.click(screen.getByRole("menuitem", { name: "Discard and restart" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Discard the Tech spec and start over?");

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(api.discardStage).toHaveBeenCalledWith("task-1", "tech_spec");
  });

  it("keeps the stage when the confirmation is refused", async () => {
    const { user } = track({ stage: "tech_spec" });

    await openMenu(user, "PRD");
    await user.click(screen.getByRole("menuitem", { name: "Back to PRD" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(api.backToStage).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("moves a reopened stage on when the user says so", async () => {
    const { user } = track({ revisiting: true, canContinue: true });

    await user.click(screen.getByRole("button", { name: "Continue to tech spec" }));

    expect(api.continueStage).toHaveBeenCalledWith("task-1");
  });

  it("waits for the agent before it lets a reopened stage continue", async () => {
    const { user } = track({ stage: "tech_spec", revisiting: true });

    const button = screen.getByRole("button", { name: "Continue to plan" });
    expect(button).toBeDisabled();

    await user.hover(button);

    expect(
      await screen.findByText("Wait for the agent to finish and the document to be written."),
    ).toBeInTheDocument();
  });

  it("has nothing to continue while the task moves forward on its own", () => {
    track({ stage: "tech_spec" });

    expect(screen.queryByRole("button", { name: /^Continue/ })).not.toBeInTheDocument();
  });
});

describe("StageTrack of a One-Shot task", () => {
  const ONE_SHOT: Partial<TaskSummary> = { mode: "one_shot", stage: "one_shot", pr: null };

  it("runs from the planning to the closing, with no PRD, tech spec or plan", () => {
    track(ONE_SHOT);

    for (const label of ["Planning", "Implementation", "PR", "PR review", "Closing"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    for (const label of ["PRD", "Tech spec", "Plan"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("offers only a restart on the planning the task is in", async () => {
    const { user } = track(ONE_SHOT);

    const menu = await openMenu(user, "Planning");

    expect(menu).toHaveTextContent("Discard and restart");
    expect(screen.queryByRole("menuitem", { name: "Back to planning" })).not.toBeInTheDocument();
  });

  it.each(["implementation", "pr"] as const)(
    "offers going back to the planning from the %s",
    async (stage) => {
      const { user } = track({ ...ONE_SHOT, stage });

      await openMenu(user, "Planning");

      expect(screen.getByRole("menuitem", { name: "Back to planning" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Discard and restart" })).toBeInTheDocument();
    },
  );

  it.each(["implementation", "pr"] as const)(
    "leaves every chip after the planning inert in the %s",
    (stage) => {
      track({ ...ONE_SHOT, stage });

      for (const label of ["Implementation", "PR", "PR review", "Closing"]) {
        expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
      }
    },
  );

  it("goes back to the planning after the confirmation", async () => {
    const { user } = track({ ...ONE_SHOT, stage: "implementation" });

    await openMenu(user, "Planning");
    await user.click(screen.getByRole("menuitem", { name: "Back to planning" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Back to planning?");
    expect(dialog).toHaveTextContent(
      "This deletes the implementation conversations and review reports, and its worktree and branch, with any uncommitted work in them. The One-Shot document and its conversation stay, and the implementation starts again from scratch when you continue.",
    );

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(api.backToStage).toHaveBeenCalledWith("task-1", "one_shot");
  });

  it("restarts the planning after the confirmation", async () => {
    const { user } = track(ONE_SHOT);

    await openMenu(user, "Planning");
    await user.click(screen.getByRole("menuitem", { name: "Discard and restart" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Discard the planning and start over?");
    expect(dialog).toHaveTextContent(
      "This deletes the planning conversation and the One-Shot document. A new planning session starts right away.",
    );

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(api.discardStage).toHaveBeenCalledWith("task-1", "one_shot");
  });

  it("moves a revisited planning on to the implementation", async () => {
    const { user } = track({ ...ONE_SHOT, revisiting: true, canContinue: true });

    expect(screen.getByRole("button", { name: "Planning · revisiting" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue to implementation" }));

    expect(api.continueStage).toHaveBeenCalledWith("task-1");
  });
});
