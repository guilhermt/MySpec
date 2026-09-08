import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepoBar } from "@/features/task/RepoBar";
import { api, type RepoPR } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepoPR, makeReview, makeState, makeTask } from "@/test/wails-mock";

const DRAFT = { title: "Add the login form", body: "Closes #12", file: "web-draft.md" };

function bar(overrides: Partial<RepoPR> = {}) {
  const repo = makeRepoPR(overrides);
  const task = makeTask({ stage: "pr", repos: [repo] });
  return renderWithStore(<RepoBar taskId={task.id} repo={repo} />, {
    state: makeState({ tasks: [task] }),
  });
}

describe("RepoBar", () => {
  it("names the repository and the state it is in", () => {
    bar({ status: "drafting" });

    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Preparing the draft");
  });

  it("spells the review out in files", () => {
    bar({ status: "in_review", review: makeReview({ staged: 1, total: 2 }) });

    expect(screen.getByRole("status")).toHaveTextContent("In review · 1 of 2 files staged");
  });

  it("carries the number and the state of the pull request", async () => {
    const { user } = bar({
      status: "reviewing",
      prNumber: 12,
      prUrl: "https://github.com/o/r/pull/12",
      prState: "open",
    });

    expect(screen.getByText("Open")).toBeInTheDocument();
    await user.click(screen.getByText("#12"));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/o/r/pull/12");
  });

  it("opens the worktree of the repository in the editor", async () => {
    const { user } = bar({ status: "reviewing" });

    await user.click(screen.getByRole("button", { name: "Open in VS Code" }));

    expect(api.openInEditor).toHaveBeenCalledWith("task-1", "/home/dev/projects/web");
  });

  it("has no worktree to open before the implementation made one", () => {
    bar({ status: "preparing", worktreePath: "" });

    expect(screen.getByRole("button", { name: "Open in VS Code" })).toBeDisabled();
  });

  it("opens the pull request from the draft on the bar", async () => {
    const { user } = bar({ status: "draft_ready", draft: DRAFT });

    await user.click(screen.getByRole("button", { name: "Open PR" }));

    expect(api.openPR).toHaveBeenCalledWith(
      "task-1",
      "/home/dev/projects/web",
      DRAFT.title,
      DRAFT.body,
    );
  });

  it("approves only with every file staged", async () => {
    bar({ status: "in_review", review: makeReview() });
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();

    const { user } = bar({
      status: "ready_to_approve",
      review: makeReview({ staged: 2, total: 2 }),
    });
    await user.click(screen.getAllByRole("button", { name: "Approve" })[1] as HTMLElement);

    expect(api.approveRepo).toHaveBeenCalledWith("task-1", "/home/dev/projects/web");
  });

  it("has no approve button before the review starts", () => {
    bar({ status: "drafting" });

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("pauses the session of the repository, not of the task", async () => {
    const { user } = bar({ status: "reviewing", sessionStage: "pr_review:web" });

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(api.pause).toHaveBeenCalledWith("task-1", "pr_review:web");
  });

  it("resumes a paused repository", async () => {
    const { user } = bar({ status: "reviewing", sessionStatus: "paused" });

    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(api.resume).toHaveBeenCalledWith("task-1", "pr:web");
  });

  it("holds the rest of the actions in the menu", async () => {
    const { user } = bar({ status: "awaiting_decision", prNumber: 12 });

    await user.click(screen.getByRole("button", { name: "Repository actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Review again" }));

    expect(api.reviewAgain).toHaveBeenCalledWith("task-1", "/home/dev/projects/web");
  });

  it("throws the draft away only while it is still a proposal", async () => {
    const { user } = bar({ status: "draft_ready", draft: DRAFT });

    await user.click(screen.getByRole("button", { name: "Repository actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Discard draft" }));

    expect(api.discardDraft).toHaveBeenCalledWith("task-1", "/home/dev/projects/web");
  });

  it("reads the pull request again on demand", async () => {
    const { user } = bar({ status: "done", prNumber: 12 });

    await user.click(screen.getByRole("button", { name: "Repository actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Refresh PR" }));

    expect(api.refreshPR).toHaveBeenCalledWith("task-1", "/home/dev/projects/web");
  });

  it("says when the last approval produced no commit", () => {
    bar({ status: "ready_to_approve", commitFailed: true });

    expect(screen.getByText("The last approval didn't produce a commit.")).toBeInTheDocument();
  });
});
