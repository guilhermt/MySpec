import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepBar } from "@/features/task/StepBar";
import { api, type Step, type TaskSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReview, makeState, makeStep, makeTask } from "@/test/wails-mock";

function bar(step: Partial<Step> = {}, overrides: Partial<TaskSummary> = {}) {
  const task = makeTask({
    stage: "implementation",
    steps: [makeStep(step), makeStep({ number: 2, file: "2-check-the-token.md" })],
    currentStep: 1,
    ...overrides,
  });
  return renderWithStore(<StepBar task={task} />, { state: makeState({ tasks: [task] }) });
}

describe("StepBar", () => {
  it("places the step in the plan, with its title and repository", () => {
    bar({ status: "awaiting_review", worktreePath: "/w/api/add-login" });

    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Add the login form")).toBeInTheDocument();
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Awaiting review");
  });

  it("names the phase of a step that is preparing", () => {
    const { container } = bar({ status: "preparing", phase: "fetching" });

    expect(screen.getByRole("status")).toHaveTextContent("Fetching origin…");
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows the session behind a step that is implementing", () => {
    bar({ status: "implementing", worktreePath: "/w/api/add-login" }, { sessionStatus: "paused" });

    expect(screen.getByRole("status")).toHaveTextContent("Paused");
  });

  it("opens the worktree in VS Code", async () => {
    const { user } = bar({ status: "awaiting_review", worktreePath: "/w/api/add-login" });

    await user.click(screen.getByRole("button", { name: "Open in VS Code" }));

    expect(api.openInEditor).toHaveBeenCalledWith("task-1", "");
  });

  it("has nothing to open before the worktree exists", () => {
    bar({ status: "preparing", phase: "fetching" });

    expect(screen.getByRole("button", { name: "Open in VS Code" })).toBeDisabled();
  });

  it("has no step to discard before the session exists", () => {
    bar({ status: "preparing", phase: "fetching" });

    expect(screen.queryByRole("button", { name: "Discard step" })).not.toBeInTheDocument();
  });

  it("asks before discarding the step", async () => {
    const { user } = bar({ status: "awaiting_review", worktreePath: "/w/api/add-login" });

    await user.click(screen.getByRole("button", { name: "Discard step" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Discard step 1 and start over?",
    );
  });

  it("counts the files of the review next to the state", () => {
    bar({
      status: "in_review",
      worktreePath: "/w/api/add-login",
      review: makeReview({ staged: 3, total: 5, percent: 60 }),
    });

    expect(screen.getByRole("status")).toHaveTextContent("In review · 3 of 5 files staged");
  });

  it("keeps the approval out of reach until every file is staged", async () => {
    const { user } = bar({
      status: "in_review",
      worktreePath: "/w/api/add-login",
      review: makeReview(),
    });

    const approve = screen.getByRole("button", { name: "Approve" });
    expect(approve).toBeDisabled();
    await user.hover(approve.parentElement as HTMLElement);

    expect(
      await screen.findByText("Stage every changed file in VS Code to approve"),
    ).toBeInTheDocument();
    expect(api.approveStep).not.toHaveBeenCalled();
  });

  it.each([
    ["nothing_to_commit", "The agent didn't change anything"],
    ["review_failed", "The worktree couldn't be read"],
  ])("says why %s cannot be approved", async (status, hint) => {
    const { user } = bar({ status, worktreePath: "/w/api/add-login", review: makeReview() });

    await user.hover(screen.getByRole("button", { name: "Approve" }).parentElement as HTMLElement);

    expect(await screen.findByText(hint)).toBeInTheDocument();
  });

  it("approves a step whose files are all staged", async () => {
    const { user } = bar({
      status: "ready_to_approve",
      worktreePath: "/w/api/add-login",
      review: makeReview({ staged: 2, total: 2, percent: 100 }),
    });

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(api.approveStep).toHaveBeenCalledWith("task-1");
  });

  it("waits for the commit while the step is committing", () => {
    const { container } = bar({
      status: "committing",
      worktreePath: "/w/api/add-login",
      review: makeReview({ staged: 2, total: 2, percent: 100 }),
    });

    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Committing");
  });

  it("has no approval to offer while the agent implements", () => {
    bar({ status: "implementing", worktreePath: "/w/api/add-login" });

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("says when the last approval produced no commit", () => {
    bar({
      status: "ready_to_approve",
      worktreePath: "/w/api/add-login",
      commitFailed: true,
      review: makeReview({ staged: 2, total: 2, percent: 100 }),
    });

    expect(screen.getByText("The last approval didn't produce a commit.")).toBeInTheDocument();
  });

  it("shows nothing when the task has no step to run", () => {
    const { container } = bar({}, { steps: [], currentStep: 0 });

    expect(container).toBeEmptyDOMElement();
  });
});
