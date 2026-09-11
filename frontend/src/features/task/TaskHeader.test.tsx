import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskHeader } from "@/features/task/TaskHeader";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepoPR, makeSituation, makeState, makeStep, makeTask } from "@/test/wails-mock";

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

  it("reads the most urgent situation of the task and how many others it has, in its tone", () => {
    const API = "/home/dev/projects/api";
    const WEB = "/home/dev/projects/web";
    header({
      stage: "pr",
      repos: [
        makeRepoPR({ repository: "api", repoPath: API, slug: "api", status: "blocked" }),
        makeRepoPR({ status: "draft_ready" }),
      ],
      situations: [
        makeSituation({
          id: "api-blocked",
          kind: "pr_blocked",
          group: "error",
          place: { kind: "repo", stage: "", step: 0, repoPath: API, repository: "api" },
        }),
        makeSituation({
          id: "web-draft",
          kind: "draft",
          place: { kind: "repo", stage: "", step: 0, repoPath: WEB, repository: "web" },
        }),
      ],
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("PR blocked +1");
    expect(status.querySelector('[aria-hidden="true"]')).toHaveClass("bg-destructive");
  });

  it("pauses a running session", async () => {
    const { user } = header({ sessionStatus: "working" });

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(api.pause).toHaveBeenCalledWith("task-1", "prd");
  });

  it("resumes a paused session", async () => {
    const { user } = header({ sessionStatus: "paused" });

    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(api.resume).toHaveBeenCalledWith("task-1", "prd");
  });

  it("has nothing to pause on a session that stopped on an error", () => {
    header({ sessionStatus: "error" });

    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  });

  it("has nothing to pause while the step has no session yet", () => {
    header({ stage: "implementation", steps: [makeStep({ status: "preparing" })], currentStep: 1 });

    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
  });

  it("pauses the session of the step being implemented", () => {
    header({
      stage: "implementation",
      steps: [makeStep({ status: "implementing" })],
      currentStep: 1,
    });

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
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

  it("reads what the deletion would destroy before asking", async () => {
    const { user } = header({ stage: "implementation" });

    await user.click(screen.getByRole("button", { name: "Delete task" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "This removes the documents, the steps and every record of the task. It can't be undone.",
    );
    expect(api.previewDelete).toHaveBeenCalledWith("task-1");
  });

  it("keeps the task when the confirmation is refused", async () => {
    const { user } = header();

    await user.click(screen.getByRole("button", { name: "Delete task" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(api.deleteTask).not.toHaveBeenCalled();
  });
});
