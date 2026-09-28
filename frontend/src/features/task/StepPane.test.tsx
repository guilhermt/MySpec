import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepPane } from "@/features/task/StepPane";
import { api, type Step, type TaskSummary } from "@/lib/wails";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore, type StoreOptions } from "@/test/render";
import {
  makeEntry,
  makeReview,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
} from "@/test/wails-mock";

const READY: Record<string, TranscriptState> = {
  "task-1|step:1": {
    status: "ready",
    error: "",
    entries: [makeEntry("user")],
    pending: [],
    buffered: [],
  },
};

// The implementer and the reviewer of step 1, each with a conversation of its own.
const BOTH_READY: Record<string, TranscriptState> = {
  ...READY,
  "task-1|step_review:1": {
    status: "ready",
    error: "",
    entries: [
      makeEntry("user", {
        user: { text: "Check the login form", pending: false, prompt: false, app: false },
      }),
    ],
    pending: [],
    buffered: [],
  },
};

const UNDER_AGENT_REVIEW: Partial<Step> = {
  status: "agent_review",
  reviewMode: "agent",
  reviewPass: 1,
  reviewer: makeStepReviewer({ sessionStatus: "working" }),
};

function pane(
  step: Partial<Step> | null,
  overrides: Partial<TaskSummary> = {},
  ui: NonNullable<StoreOptions["ui"]> = { transcripts: READY },
) {
  const task = makeTask({
    stage: "implementation",
    steps: step === null ? [] : [makeStep(step)],
    currentStep: step === null ? 0 : 1,
    ...overrides,
  });
  return renderWithStore(<StepPane task={task} />, {
    state: makeState({ tasks: [task] }),
    ui,
  });
}

describe("StepPane", () => {
  it("shows the conversation of a step that has one", () => {
    pane({ status: "implementing" });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it.each(["agent_review", "addressing_review"])(
    "keeps the conversation while the step is in %s",
    (status) => {
      pane({ status });

      expect(screen.getByText("Add a login screen")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    },
  );

  it("shows the conversation of the reviewer on its tab", async () => {
    const { user } = pane(
      UNDER_AGENT_REVIEW,
      {},
      {
        transcripts: BOTH_READY,
        openStepTab: { "task-1|1": "reviewer" },
      },
    );

    expect(screen.getByText("Check the login form")).toBeInTheDocument();
    expect(screen.queryByText("Add a login screen")).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "The test is missing{Enter}");

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "step_review:1", "The test is missing");
  });

  it("keeps the draft of each conversation apart when the tab changes", async () => {
    const { user } = pane(UNDER_AGENT_REVIEW, {}, { transcripts: BOTH_READY });

    await user.type(screen.getByRole("textbox"), "For the implementer");
    await user.click(screen.getByRole("tab", { name: /Reviewer/ }));

    expect(screen.getByText("Check the login form")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");

    await user.click(screen.getByRole("tab", { name: /Implementer/ }));

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("For the implementer");
  });

  it("shows only the conversation of the implementer while the step has no reviewer", () => {
    pane({ status: "implementing", reviewMode: "agent" });

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
  });

  it("keeps the review strip out under the agent review", () => {
    pane(UNDER_AGENT_REVIEW, {}, { transcripts: BOTH_READY });

    expect(screen.queryByRole("progressbar", { name: "Review progress" })).not.toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Conversations" })).toBeInTheDocument();
    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
  });

  it("keeps the conversation while the step waits for review", () => {
    pane({ status: "awaiting_review" });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
  });

  it("shows why a blocked step did not start, and no conversation", () => {
    pane({
      status: "blocked",
      block: { reason: "path_exists", detail: "", files: 0 },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("The worktree folder already exists");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("says what the app is doing while the step prepares", () => {
    pane({ status: "preparing", phase: "creating" });

    expect(screen.getByRole("status")).toHaveTextContent("Creating the worktree…");
  });

  it("waits for a step that has not started yet", () => {
    pane({ status: "not_started" });

    expect(screen.getByRole("status")).toHaveTextContent("Starting…");
  });

  it("puts the review above the conversation while the step is reviewed", () => {
    pane({ status: "in_review", review: makeReview({ staged: 3, total: 5, percent: 60 }) });

    expect(screen.getByRole("progressbar", { name: "Review progress" })).toBeInTheDocument();
    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
  });

  it("keeps the conversation while the commit is being made", () => {
    pane({ status: "committing", review: makeReview({ staged: 2, total: 2, percent: 100 }) });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
  });

  it("closes the implementation once every step is committed", () => {
    const task = makeTask({
      stage: "implementation",
      currentStep: 0,
      steps: [makeStep({ status: "done" })],
    });

    renderWithStore(<StepPane task={task} />, {
      state: makeState({ tasks: [task] }),
      ui: { transcripts: READY },
    });

    expect(screen.getByText("Every step is committed")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("says so when the plan has no steps", () => {
    pane(null);

    expect(screen.getByText("No steps were found.")).toBeInTheDocument();
  });
});
