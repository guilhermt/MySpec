import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepPane } from "@/features/task/StepPane";
import type { Step, TaskSummary } from "@/lib/wails";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore } from "@/test/render";
import { makeEntry, makeReview, makeState, makeStep, makeTask } from "@/test/wails-mock";

const READY: Record<string, TranscriptState> = {
  "task-1": { status: "ready", entries: [makeEntry("user")], pending: [], buffered: [] },
};

function pane(step: Partial<Step> | null, overrides: Partial<TaskSummary> = {}) {
  const task = makeTask({
    stage: "implementation",
    steps: step === null ? [] : [makeStep(step)],
    currentStep: step === null ? 0 : 1,
    ...overrides,
  });
  return renderWithStore(<StepPane task={task} />, {
    state: makeState({ tasks: [task] }),
    ui: { transcripts: READY },
  });
}

describe("StepPane", () => {
  it("shows the conversation of a step that has one", () => {
    pane({ status: "implementing" });

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
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
