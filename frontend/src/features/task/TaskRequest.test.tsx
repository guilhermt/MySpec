import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskRequest } from "@/features/task/TaskRequest";
import { api, type PullRequest, type Situation, type Step, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makePullRequest,
  makeReview,
  makeSituation,
  makeState,
  makeStep,
  makeTask,
} from "@/test/wails-mock";

function request(overrides: Partial<TaskSummary>, prDrafts: object = {}) {
  const task = makeTask(overrides);
  return renderWithStore(<TaskRequest task={task} tab="implementer" />, {
    state: makeState({ tasks: [task] }),
    ui: { prDrafts: prDrafts as never },
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

const onPR = (kind: string, form = "") =>
  makeSituation({ kind, form, place: { kind: "pr", stage: "", step: 0 } });

const DRAFT = { title: "Add the login form", body: "Closes #12", file: "draft.md" };

// inDraft is the task whose pull request draft waits for the user's approval.
function inDraft(): Partial<TaskSummary> {
  return {
    stage: "pr",
    pr: makePullRequest({ status: "draft_ready", sessionStage: "pr", draft: DRAFT }),
    situations: [onPR("draft")],
  };
}

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

  it("opens the pull request with the draft the user edited", async () => {
    const { user } = request(inDraft(), { "task-1": { title: "Mine", body: "My body" } });

    await user.click(screen.getByRole("button", { name: "Approve draft" }));

    expect(api.openPR).toHaveBeenCalledWith("task-1", "Mine", "My body");
  });

  it("opens the pull request with the agent's draft when the user edited nothing", async () => {
    const { user } = request(inDraft());

    await user.click(screen.getByRole("button", { name: "Approve draft" }));

    expect(api.openPR).toHaveBeenCalledWith("task-1", DRAFT.title, DRAFT.body);
  });

  it("closes a merged task from its bar", async () => {
    const { user } = request({
      stage: "pr",
      pr: makePullRequest({ status: "merged", prNumber: 12, canClose: true }),
      situations: [onPR("merge", "close")],
    });

    await user.click(screen.getByRole("button", { name: "Close task" }));

    expect(api.closeTask).toHaveBeenCalledWith("task-1");
  });

  it("asks for another pass on a pull request in trouble", async () => {
    const { user } = request({
      stage: "pr",
      pr: makePullRequest({
        status: "trouble",
        prNumber: 12,
        trouble: { failedChecks: ["build"], conflict: false },
      }),
      situations: [onPR("pr_trouble", "checks")],
    });

    await user.click(screen.getByRole("button", { name: "Review again" }));

    expect(api.reviewAgain).toHaveBeenCalledWith("task-1");
  });

  it("confirms the deletion of a task whose pull request was closed unmerged", async () => {
    const { user } = request({
      stage: "pr",
      pr: makePullRequest({ status: "pr_closed", prNumber: 12 }),
      situations: [onPR("pr_closed")],
    });

    await user.click(screen.getByRole("button", { name: "Delete task…" }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(api.deleteTask).not.toHaveBeenCalled();
  });

  it("draws nothing when nothing is asked", () => {
    request(inStep({ status: "implementing" }, []));

    expect(screen.queryByRole("region", { name: "Request" })).not.toBeInTheDocument();
  });

  it("keeps the status text as the situation was born, through a change of the form", () => {
    const pr = (overrides: Partial<PullRequest>) =>
      makePullRequest({ status: "done", canClose: true, prNumber: 1284, ...overrides });
    const done = makeTask({
      stage: "pr",
      pr: pr({ status: "done" }),
      situations: [onPR("merge", "close")],
    });

    const { rerender } = renderWithStore(<TaskRequest task={done} tab="implementer" />, {
      state: makeState({ tasks: [done] }),
    });

    expect(screen.getByRole("status")).toHaveTextContent("Ready to close · #1284");
    expect(screen.getByRole("region", { name: "Request" })).not.toHaveTextContent("merged");

    const merged = makeTask({
      stage: "pr",
      pr: pr({ status: "merged" }),
      situations: [onPR("merge", "close")],
    });

    rerender(<TaskRequest task={merged} tab="implementer" />);

    // The visible place moves from "#1284" to "#1284 merged", but the status announced once, the
    // situation was born with, does not change.
    expect(screen.getByRole("region", { name: "Request" })).toHaveTextContent("#1284 merged");
    expect(screen.getByRole("status")).toHaveTextContent("Ready to close · #1284");
  });

  it("disables approving the draft once the edited title is blank", () => {
    request(inDraft(), { "task-1": { title: " ", body: "still here" } });

    expect(screen.getByRole("button", { name: "Approve draft" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("Write a title and a description")).toBeInTheDocument();
  });

  it("enables approving the draft once the user fills what the agent left blank", () => {
    request(
      {
        stage: "pr",
        pr: makePullRequest({ status: "draft_ready", sessionStage: "pr", draft: null }),
        situations: [onPR("draft")],
      },
      { "task-1": { title: "Add the login form", body: "Closes #12" } },
    );

    expect(screen.getByRole("button", { name: "Approve draft" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
