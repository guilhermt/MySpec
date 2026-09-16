import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskHeader } from "@/features/task/TaskHeader";
import { api, type TaskSummary } from "@/lib/wails";
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

function header(overrides: Partial<TaskSummary> = {}, onToggle = vi.fn()) {
  const task = makeTask(overrides);
  return renderWithStore(
    <TaskHeader task={task} artifactsOpen={false} onToggleArtifacts={onToggle} />,
    { state: makeState({ tasks: [task] }) },
  );
}

describe("TaskHeader", () => {
  it("names the task and the repository it belongs to", () => {
    header();

    expect(screen.getByText("add-login")).toBeInTheDocument();
    expect(screen.getByText("dev/web")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting");
  });

  it("shows the card the task was created from", () => {
    header({ card: makeTaskCard() });

    expect(screen.getByRole("button", { name: "#12" })).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("shows no card for a task without one", () => {
    header();

    expect(screen.queryByRole("button", { name: "#12" })).not.toBeInTheDocument();
  });

  it("labels a One-Shot task", () => {
    header({ mode: "one_shot", stage: "one_shot" });

    expect(screen.getByText("One-Shot")).toBeInTheDocument();
  });

  it("has no label for a Structured task", () => {
    header();

    expect(screen.queryByText("One-Shot")).not.toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Review mode: Agent" }));

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

    await user.click(screen.getByRole("button", { name: "Review mode: Manual" }));

    expect(await screen.findByRole("button", { name: "Task review mode: Manual" })).toBeDisabled();
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

  it.each([
    [{ hasPrd: true }],
    [{ hasTechSpec: true }],
    [{ hasOneShot: true }],
    [{ steps: [makeStep()] }],
  ])("opens the panel on anything the task wrote %#", async (overrides) => {
    const { user } = header(overrides);

    await user.hover(screen.getByRole("button", { name: "Artifacts" }));

    expect(await screen.findByText("Artifacts")).toBeInTheDocument();
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
