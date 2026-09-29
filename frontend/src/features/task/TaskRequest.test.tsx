import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskRequest } from "@/features/task/TaskRequest";
import { api, type PullRequest, type Situation, type Step, type TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makePullRequest,
  makeReview,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
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

const blockedStep = () =>
  makeSituation({
    id: "s-blocked",
    kind: "step_blocked",
    group: "error",
    place: { kind: "step", stage: "", step: 1 },
  });

const REVIEWER_3 = { kind: "step_review", stage: "", step: 3 };

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

    const bar = screen.getByRole("region", { name: "Request" });
    expect(bar).toHaveTextContent("Ready to continue");
    expect(bar).toHaveTextContent("· PRD");
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

  it("announces nothing of the situation already there when the screen opens", () => {
    request(inStep({ status: "awaiting_review", review: makeReview() }, [onStep("step_review")]));

    expect(screen.getByRole("status")).toHaveTextContent(/^$/);
  });

  it("announces a situation born with the screen open as it was born, through a change of the form", () => {
    const pr = (overrides: Partial<PullRequest>) =>
      makePullRequest({ status: "done", canClose: true, prNumber: 1284, ...overrides });
    const before = makeTask({ stage: "pr", pr: pr({ status: "awaiting_decision" }) });
    const done = makeTask({
      stage: "pr",
      pr: pr({ status: "done" }),
      situations: [onPR("merge", "close")],
    });

    const { rerender } = renderWithStore(<TaskRequest task={before} tab="implementer" />, {
      state: makeState({ tasks: [before] }),
    });
    rerender(<TaskRequest task={done} tab="implementer" />);

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

  it("blinks while its situation flashes, in the veil of its gravity", () => {
    const task = makeTask(inStep({ status: "blocked" }, [blockedStep()]));
    renderWithStore(<TaskRequest task={task} tab="implementer" />, {
      state: makeState({ tasks: [task] }),
      ui: { flashing: new Set([task.situations?.[0]?.id ?? ""]) },
    });

    const bar = screen.getByRole("region", { name: "Request" });
    expect(bar).toHaveClass("situation-flash");
    expect(bar).toHaveAttribute("data-flash", "error");
  });

  it("tries the blocked step again", async () => {
    const { user } = request(
      inStep({ status: "blocked", block: { reason: "fetch_failed", detail: "", files: 0 } }, [
        blockedStep(),
      ]),
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(api.retryStep).toHaveBeenCalledWith("task-1");
  });

  it("changes the path of a missing clone", async () => {
    const { user } = request(
      inStep({ status: "blocked", block: { reason: "clone_missing", detail: "", files: 0 } }, [
        blockedStep(),
      ]),
    );

    await user.click(screen.getByRole("button", { name: "Change path…" }));

    expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
  });

  it("asks before cleaning the worktree, then cleans it and starts the step", async () => {
    const { user } = request(
      inStep(
        {
          status: "blocked",
          block: { reason: "dirty_worktree", detail: " M src/app.ts\n?? notes.md", files: 2 },
        },
        [blockedStep()],
      ),
    );

    await user.click(screen.getByRole("button", { name: "Clean and start…" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Clean the worktree and start step 1?",
    });
    expect(dialog).toHaveTextContent("M src/app.ts");
    await user.click(within(dialog).getByRole("button", { name: "Clean and start" }));

    expect(api.cleanAndStartStep).toHaveBeenCalledWith("task-1");
  });

  it("tries the blocked pull request again", async () => {
    const { user } = request({
      stage: "pr",
      pr: makePullRequest({ status: "blocked", block: { reason: "gh_failed", detail: "" } }),
      situations: [onPR("pr_blocked")],
    });

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(api.retryPR).toHaveBeenCalledWith("task-1");
  });

  it("approves the draft a failed opening left, from the reply of the PR", async () => {
    const { user } = request({
      stage: "pr",
      pr: makePullRequest({ status: "awaiting_reply", sessionStage: "pr", draft: DRAFT }),
      situations: [onPR("reply")],
    });

    await user.click(screen.getByRole("button", { name: "Approve draft" }));

    expect(api.openPR).toHaveBeenCalledWith("task-1", DRAFT.title, DRAFT.body);
  });

  it("asks the conversation to open the marker of the problems of the plan", async () => {
    const { user } = request({
      stage: "plan",
      planProblems: [{ file: "02.md", message: "no title" }],
      situations: [
        makeSituation({ kind: "plan_invalid", place: { kind: "stage", stage: "plan", step: 0 } }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "Show problems" }));

    expect(useAppStore.getState().markerRequest).toEqual({
      taskId: "task-1",
      type: "plan_invalid",
    });
  });

  it("leads to the other conversation of the step when only it asks", async () => {
    const task = makeTask({
      ...inStep({ status: "agent_review", reviewer: makeStepReviewer() }, [
        makeSituation({ kind: "question", place: { kind: "step_review", stage: "", step: 1 } }),
      ]),
    });
    const { user } = renderWithStore(<TaskRequest task={task} tab="implementer" />, {
      state: makeState({ tasks: [task] }),
    });

    expect(screen.getByRole("region", { name: "Request" })).toHaveTextContent(
      "The reviewer waits · Question",
    );
    await user.click(screen.getByRole("button", { name: "Go to reviewer" }));

    expect(useAppStore.getState().openStepTab).toEqual({ "task-1|1": "reviewer" });
  });

  // P3: Retry restarts the session of the situation, and a reviewer that comes back without the
  // report of its pass waits for a reply, answered through the composer.
  it("retries the reviewer that stopped, then waits for its reply", async () => {
    const stopped = makeTask(
      inStep(
        {
          number: 3,
          status: "agent_review",
          reviewer: makeStepReviewer({ sessionStage: "step_review:3", lastError: "exit 1" }),
        },
        [makeSituation({ kind: "session_error", group: "error", place: REVIEWER_3 })],
      ),
    );
    const { user, rerender } = renderWithStore(
      <TaskRequest task={{ ...stopped, currentStep: 3 }} tab="reviewer" />,
      {
        state: makeState({ tasks: [stopped] }),
      },
    );

    await user.click(screen.getByRole("button", { name: "Retry reviewer" }));
    expect(api.retry).toHaveBeenCalledWith("task-1", "step_review:3");

    const waiting = makeTask(
      inStep(
        {
          number: 3,
          status: "agent_review",
          reviewer: makeStepReviewer({ sessionStage: "step_review:3" }),
        },
        [makeSituation({ id: "s-reply", kind: "reply", place: REVIEWER_3 })],
      ),
    );
    rerender(<TaskRequest task={{ ...waiting, currentStep: 3 }} tab="reviewer" />);

    const bar = screen.getByRole("region", { name: "Request" });
    expect(bar).toHaveTextContent("Waiting for reply");
    expect(bar).toHaveTextContent("Reviewer");
    expect(within(bar).queryByRole("button")).not.toBeInTheDocument();
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
