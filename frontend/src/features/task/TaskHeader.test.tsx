import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskHeader } from "@/features/task/TaskHeader";
import { api, type TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makePullRequest,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

function header(overrides: Partial<TaskSummary> = {}) {
  const task = makeTask(overrides);
  return renderWithStore(<TaskHeader task={task} />, {
    state: makeState({ tasks: [task] }),
    ui: { location: { kind: "task", id: task.id } },
  });
}

describe("TaskHeader", () => {
  it("names the place after the task, with its state on the right", () => {
    header();

    expect(screen.getByRole("heading", { level: 1, name: "add-login" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting");
  });

  it("leaves the repository, the card number and the One-Shot label to the tree", () => {
    header({ mode: "one_shot", stage: "one_shot", card: makeTaskCard() });

    expect(screen.queryByText("dev/web")).not.toBeInTheDocument();
    expect(screen.queryByText("#12")).not.toBeInTheDocument();
    expect(screen.queryByText("One-Shot")).not.toBeInTheDocument();
  });

  it("opens the card the task was created from on GitHub", async () => {
    const { user } = header({ card: makeTaskCard() });

    await user.click(screen.getByRole("button", { name: "Open card #12 on GitHub · In progress" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/12");
  });

  it("names the card by its number alone when the board gives it no status", () => {
    header({ card: makeTaskCard({ status: "" }) });

    expect(screen.getByRole("button", { name: "Open card #12 on GitHub" })).toBeInTheDocument();
  });

  it("has no card link for a task without one", () => {
    header();

    expect(screen.queryByRole("button", { name: /^Open card/ })).not.toBeInTheDocument();
  });

  it("holds its controls on the right in their order", () => {
    header({ sessionStatus: "working", card: makeTaskCard() });

    const names = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names).toEqual([
      "Back",
      "Show the hidden levels: No board",
      "Pause",
      "Review: Manual",
      "Models",
      "Open card #12 on GitHub · In progress",
      "Artifacts",
      "Delete task",
    ]);
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
    const place = { kind: "pr", stage: "", step: 0 };
    header({
      stage: "pr",
      pr: makePullRequest({ status: "blocked" }),
      situations: [
        makeSituation({ id: "pr-blocked", kind: "pr_blocked", group: "error", place }),
        makeSituation({ id: "pr-draft", kind: "draft", place }),
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

    expect(screen.getByRole("button", { name: "Pause" })).toHaveAttribute("aria-disabled", "true");
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

  it("pauses the reviewer during a pass", async () => {
    const { user } = header({
      stage: "implementation",
      sessionStatus: "waiting",
      contextPercent: 10,
      steps: [
        makeStep({
          status: "agent_review",
          reviewMode: "agent",
          reviewPass: 1,
          reviewer: makeStepReviewer({ sessionStatus: "working", contextPercent: 72 }),
        }),
      ],
      currentStep: 1,
    });

    // The gauge reads the context of the conversation the step waits on.
    expect(screen.getByText("72%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(api.pause).toHaveBeenCalledWith("task-1", "step_review:1");
  });

  it("resumes the reviewer paused during a pass", async () => {
    const { user } = header({
      stage: "implementation",
      steps: [
        makeStep({
          status: "agent_review",
          reviewMode: "agent",
          reviewPass: 1,
          reviewer: makeStepReviewer({ sessionStatus: "paused" }),
        }),
      ],
      currentStep: 1,
    });

    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(api.resume).toHaveBeenCalledWith("task-1", "step_review:1");
  });

  it("pauses the implementer while it addresses a report", async () => {
    const { user } = header({
      stage: "implementation",
      sessionStatus: "working",
      steps: [
        makeStep({
          status: "addressing_review",
          reviewMode: "agent",
          reviewRound: 1,
          reviewer: makeStepReviewer({ sessionStatus: "paused" }),
        }),
      ],
      currentStep: 1,
    });

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(api.pause).toHaveBeenCalledWith("task-1", "step:1");
  });

  it("has the models of the task a click away", async () => {
    const { user } = header();

    await user.click(screen.getByRole("button", { name: "Models" }));

    expect(await screen.findByRole("heading", { name: "Models" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Plan model: Fable 5.1 · high" }),
    ).toBeInTheDocument();
  });

  it("has the review mode of the task a click away", async () => {
    const { user } = header({ reviewMode: "agent" });

    await user.click(screen.getByRole("button", { name: "Review: Agent" }));

    expect(await screen.findByRole("heading", { name: "Review mode" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "A change applies to the steps that haven't started and have no choice of their own.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Task review mode: Agent" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Manual" }));

    expect(api.setReviewMode).toHaveBeenCalledWith("task-1", "manual");
    // The menu is a child popup of the panel: a click in it leaves the panel open.
    expect(screen.getByRole("heading", { name: "Review mode" })).toBeInTheDocument();
  });

  it("keeps the review mode as it is once every step started", async () => {
    const { user } = header({ reviewModeEditable: false });

    await user.click(screen.getByRole("button", { name: "Review: Manual" }));

    expect(await screen.findByRole("button", { name: "Task review mode: Manual" })).toBeDisabled();
  });

  it("toggles the artifacts panel, named in its tooltip", async () => {
    const { user } = header();
    const artifacts = () => screen.getByRole("button", { name: "Artifacts" });

    await user.hover(artifacts());
    expect(await screen.findByText("PRD, tech spec, steps and reports")).toBeInTheDocument();

    await user.click(artifacts());
    expect(useAppStore.getState().panel).toBe("artifacts");
    expect(artifacts()).toHaveAttribute("aria-pressed", "true");

    await user.click(artifacts());
    expect(useAppStore.getState().panel).toBeNull();
    expect(artifacts()).toHaveAttribute("aria-pressed", "false");
  });

  it("names the delete button in its tooltip", async () => {
    const { user } = header();

    await user.hover(screen.getByRole("button", { name: "Delete task" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Delete task");
  });

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
