import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskView } from "@/features/task/TaskView";
import { api, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makePullRequest,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
} from "@/test/wails-mock";

function view(overrides: Partial<TaskSummary> = {}) {
  return renderWithStore(<TaskView taskId="task-1" />, {
    state: makeState({ tasks: [makeTask(overrides)] }),
    ui: { location: { kind: "task", id: "task-1" } },
  });
}

describe("TaskView", () => {
  it("puts the conversation, the composer and the header together", async () => {
    view();

    expect(screen.getByText("add-login")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "prd");
    });
  });

  it("puts the stage track under the header", () => {
    view({ stage: "tech_spec" });

    const chips = screen.getAllByRole("button", { name: "PRD" });
    expect(chips.some((chip) => chip.getAttribute("aria-haspopup") === "menu")).toBe(true);
    expect(screen.getByText("Closing")).toBeInTheDocument();
  });

  it("shows the step being run instead of a conversation of its own", () => {
    view({
      stage: "implementation",
      steps: [makeStep({ status: "preparing", phase: "fetching" })],
      currentStep: 1,
    });

    expect(screen.getByText("Step 1 of 1")).toBeInTheDocument();
    // The bar names the phase next to the step, the pane in the empty space
    // where the conversation will be.
    expect(screen.getAllByText("Fetching origin…")).toHaveLength(2);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("fetches the conversation of a step that opened a session", async () => {
    view({
      stage: "implementation",
      steps: [makeStep({ status: "implementing", worktreePath: "/w/api/add-login" })],
      currentStep: 1,
    });

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "step:1");
    });
  });

  it("fetches the conversation of the reviewer when its tab opens", async () => {
    const { user } = view({
      stage: "implementation",
      steps: [
        makeStep({
          status: "agent_review",
          reviewMode: "agent",
          reviewPass: 1,
          worktreePath: "/w/api/add-login",
          reviewer: makeStepReviewer({ sessionStatus: "working" }),
        }),
      ],
      currentStep: 1,
    });
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "step:1");
    });
    expect(api.getTranscript).not.toHaveBeenCalledWith("task-1", "step_review:1");

    await user.click(screen.getByRole("tab", { name: /Reviewer/ }));

    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "step_review:1");
    });
  });

  it("shows no conversation while the step is blocked", () => {
    view({
      stage: "implementation",
      steps: [
        makeStep({
          status: "blocked",
          block: { reason: "fetch_failed", detail: "fatal: unable to access", files: 0 },
        }),
      ],
      currentStep: 1,
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't fetch origin");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("warns above the composer when the plan stayed invalid", () => {
    view({
      stage: "plan",
      corrections: 3,
      planProblems: [{ file: "", message: "no step files were written" }],
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The plan is still invalid after three automatic corrections.",
    );
  });

  it("fetches the conversation only the first time the task is opened", async () => {
    const { rerender } = view();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledOnce();
    });

    rerender(<TaskView taskId="task-1" />);

    expect(api.getTranscript).toHaveBeenCalledOnce();
  });

  it("keeps the artifacts panel closed until the user opens it", () => {
    view({ hasPrd: true, artifactVersion: 1 });

    expect(screen.queryByRole("complementary", { name: "Artifacts" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Artifacts" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("opens the artifacts panel from its button", async () => {
    const { user } = view({ hasPrd: true, artifactVersion: 1 });

    await user.click(screen.getByRole("button", { name: "Artifacts" }));

    expect(screen.getByRole("complementary", { name: "Artifacts" })).toBeInTheDocument();
  });

  it("shows nothing for a task that is no longer there", () => {
    renderWithStore(<TaskView taskId="task-1" />, { state: makeState() });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("shows the pull request instead of a conversation of its own in the PR stage", async () => {
    view({
      stage: "pr",
      pr: makePullRequest({
        status: "draft_ready",
        draft: { title: "Wire the api", body: "why", file: "draft.md" },
      }),
    });

    expect(screen.getByLabelText("Title")).toHaveValue("Wire the api");
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "pr");
    });
  });

  it("asks for no conversation while the pull request has none", () => {
    view({ stage: "pr", pr: makePullRequest({ status: "preparing", sessionStage: "" }) });

    expect(screen.getByText("Checking GitHub…")).toBeInTheDocument();
    expect(api.getTranscript).not.toHaveBeenCalled();
  });

  it("lets nothing but the conversation scroll in its column", () => {
    view();

    const column = screen.getByRole("textbox").closest(".overflow-clip");
    expect(column).not.toBeNull();
  });
});
