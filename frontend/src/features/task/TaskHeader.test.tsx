import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskHeader } from "@/features/task/TaskHeader";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeStep, makeTask } from "@/test/wails-mock";

function header(overrides: Partial<TaskSummary> = {}, onToggle = vi.fn()) {
  const task = makeTask(overrides);
  return renderWithStore(
    <TaskHeader task={task} artifactsOpen={false} onToggleArtifacts={onToggle} />,
    { state: makeState({ tasks: [task] }) },
  );
}

describe("TaskHeader", () => {
  it("names the task and its place", () => {
    header();

    expect(screen.getByText("add-login")).toBeInTheDocument();
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting");
  });

  it("names the repository a task belongs to", () => {
    header({ repoPath: "/home/dev/projects/api" });

    expect(screen.getByText("api")).toBeInTheDocument();
  });

  it.each([
    [{}, "Waiting"],
    [{ sessionStatus: "working" }, "Working"],
    [{ sessionStatus: "needs_permission" }, "Permission"],
    [{ sessionStatus: "paused" }, "Paused"],
    [{ sessionStatus: "error" }, "Error"],
  ] as const)("shows the state of the session %#", (overrides, expected) => {
    header(overrides);

    expect(screen.getByRole("status")).toHaveTextContent(expected);
  });

  it("pauses a running session", async () => {
    const { user } = header({ sessionStatus: "working" });

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(api.pause).toHaveBeenCalledWith("task-1");
  });

  it("resumes a paused session", async () => {
    const { user } = header({ sessionStatus: "paused" });

    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(api.resume).toHaveBeenCalledWith("task-1");
  });

  it("has nothing to pause on a session that stopped on an error", () => {
    header({ sessionStatus: "error" });

    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  });

  it("has nothing to pause once the task is implementing", () => {
    header({ stage: "implementation" });

    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
  });

  it("says the panel is empty until an artifact exists", async () => {
    const onToggle = vi.fn();
    const { user } = header({}, onToggle);

    await user.hover(screen.getByRole("button", { name: "Artifacts" }));
    expect(await screen.findByText("No artifacts yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Artifacts" }));

    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Artifacts" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it.each([[{ hasPrd: true }], [{ hasTechSpec: true }], [{ steps: [makeStep()] }]])(
    "opens the panel on anything the task wrote %#",
    async (overrides) => {
      const { user } = header(overrides);

      await user.hover(screen.getByRole("button", { name: "Artifacts" }));

      expect(await screen.findByText("Artifacts")).toBeInTheDocument();
    },
  );

  it("deletes the task after the confirmation", async () => {
    const { user } = header();

    await user.click(screen.getByRole("button", { name: "Delete task" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent('Delete "add-login"?');

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.deleteTask).toHaveBeenCalledWith("task-1");
  });

  it("warns about the worktrees when the task is implementing", async () => {
    const { user } = header({ stage: "implementation" });

    await user.click(screen.getByRole("button", { name: "Delete task" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "The worktrees and branches of the task are removed too, with any uncommitted work in them.",
    );
  });

  it("keeps the task when the confirmation is refused", async () => {
    const { user } = header();

    await user.click(screen.getByRole("button", { name: "Delete task" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(api.deleteTask).not.toHaveBeenCalled();
  });
});
