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
