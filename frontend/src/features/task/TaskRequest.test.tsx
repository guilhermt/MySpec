import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskRequest } from "@/features/task/TaskRequest";
import { api, type Situation, type Step, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makePullRequest,
  makeReview,
  makeSituation,
  makeState,
  makeStep,
  makeTask,
} from "@/test/wails-mock";

function request(overrides: Partial<TaskSummary>) {
  const task = makeTask(overrides);
  return renderWithStore(<TaskRequest task={task} tab="implementer" />, {
    state: makeState({ tasks: [task] }),
  });
}

function inStep(step: Partial<Step>, situations: Situation[], sessionStatus = "waiting") {
  return {
    stage: "implementation",
    currentStep: 1,
    worktreePath: "/w/api/add-login",
    sessionStatus,
    steps: [makeStep({ worktreePath: "/w/api/add-login", ...step })],
    situations,
  };
}

const onStep = (kind: string, form = "") =>
  makeSituation({ kind, form, place: { kind: "step", stage: "", step: 1 } });

const STAGED = makeReview({ staged: 2, total: 2, percent: 100 });

describe("TaskRequest", () => {
  it("asks for the review of the step, with how far it got", () => {
    request(inStep({ status: "awaiting_review", review: makeReview() }, [onStep("step_review")]));

    const bar = screen.getByRole("region", { name: "Request" });
    expect(bar).toHaveTextContent("Review step 1");
    expect(bar).toHaveTextContent("1 of 2 files staged · 50%");
    expect(screen.getByRole("button", { name: "Approve" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("Stage 1 more file")).toBeInTheDocument();
  });

  it("approves the step once every file is staged", async () => {
    let finish = () => {};
    vi.mocked(api.approveStep).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = request(
      inStep({ status: "ready_to_approve", review: STAGED }, [onStep("step_review", "approve")]),
    );

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(api.approveStep).toHaveBeenCalledWith("task-1");
    expect(await screen.findByRole("button", { name: "Approving…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    finish();
    expect(await screen.findByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("opens the worktree in VS Code", async () => {
    const { user } = request(
      inStep({ status: "awaiting_review", review: makeReview() }, [onStep("step_review")]),
    );

    await user.click(screen.getByRole("button", { name: "Open in VS Code" }));

    expect(api.openInEditor).toHaveBeenCalledWith("task-1");
  });

  it("asks before discarding a step without changes", async () => {
    const { user } = request(inStep({ status: "nothing_to_commit" }, [onStep("step_empty")]));

    expect(screen.getByRole("region", { name: "Request" })).toHaveTextContent(
      "Step 1 has no changes",
    );
    await user.click(screen.getByRole("button", { name: "Discard step 1…" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Discard step 1");
  });

  it("keeps the bar of the step quiet while the task is paused", () => {
    request(inStep({ status: "ready_to_approve", review: STAGED }, [], "paused"));

    const bar = screen.getByRole("region", { name: "Request" });
    expect(bar).toHaveAttribute("data-form", "quiet");
    expect(bar).toHaveTextContent("Approve step 1");
  });

  it("moves a revisited stage on", async () => {
    const { user } = request({
      stage: "prd",
      revisiting: true,
      canContinue: true,
      situations: [
        makeSituation({
          kind: "ready_to_continue",
          place: { kind: "stage", stage: "prd", step: 0 },
        }),
      ],
    });

    expect(screen.getByRole("region", { name: "Request" })).toHaveTextContent(
      "Ready to continue · PRD",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(api.continueStage).toHaveBeenCalledWith("task-1");
  });

  it("leaves the bars of the pull request out", () => {
    request({
      stage: "pr",
      pr: makePullRequest({ status: "draft_ready", sessionStage: "pr" }),
      situations: [makeSituation({ kind: "draft", place: { kind: "pr", stage: "", step: 0 } })],
    });

    expect(screen.queryByRole("region", { name: "Request" })).not.toBeInTheDocument();
  });

  it("draws nothing when nothing is asked", () => {
    request(inStep({ status: "implementing" }, []));

    expect(screen.queryByRole("region", { name: "Request" })).not.toBeInTheDocument();
  });
});
