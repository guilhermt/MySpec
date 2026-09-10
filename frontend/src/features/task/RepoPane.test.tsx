import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepoPane } from "@/features/task/RepoPane";
import { api, type RepoPR } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeCloseResult, makeRepoPR, makeReview, makeState, makeTask } from "@/test/wails-mock";

const DRAFT = { title: "Add the login form", body: "Closes #12", file: "web-draft.md" };

function pane(overrides: Partial<RepoPR> = {}) {
  const repo = makeRepoPR(overrides);
  const task = makeTask({ stage: "pr", repos: [repo] });
  return renderWithStore(<RepoPane taskId={task.id} repo={repo} />, {
    state: makeState({ tasks: [task] }),
    ui: {
      transcripts: {
        "task-1|pr:web": { status: "ready", entries: [], pending: [], buffered: [] },
        "task-1|pr_review:web": { status: "ready", entries: [], pending: [], buffered: [] },
      },
    },
  });
}

describe("RepoPane", () => {
  it("waits while the app checks GitHub", () => {
    pane({ status: "preparing" });

    expect(screen.getByRole("status")).toHaveTextContent("Checking GitHub…");
  });

  it("shows the block instead of a conversation", () => {
    pane({ status: "blocked", block: { reason: "gh_missing", detail: "" } });

    expect(screen.getByRole("alert")).toHaveTextContent("GitHub CLI was not found");
    expect(screen.queryByPlaceholderText("Reply to the agent…")).not.toBeInTheDocument();
  });

  it("is the conversation alone while the agent writes the draft", () => {
    pane({ status: "drafting" });

    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("puts the draft above the conversation once it is ready", () => {
    pane({ status: "draft_ready", draft: DRAFT });

    expect(screen.getByLabelText("Title")).toHaveValue(DRAFT.title);
    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
  });

  it("says the pull request is being opened", () => {
    pane({ status: "opening", draft: DRAFT });

    expect(screen.getByText("Opening the pull request…")).toBeInTheDocument();
  });

  it("is the conversation alone while the agent reviews", () => {
    pane({ status: "reviewing", prNumber: 12, sessionStage: "pr_review:web" });

    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("puts the review strip above the conversation once changes are applied", () => {
    pane({
      status: "in_review",
      prNumber: 12,
      sessionStage: "pr_review:web",
      review: makeReview({ staged: 1, total: 2, percent: 50 }),
    });

    expect(screen.getByRole("progressbar", { name: "Review progress" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
  });

  it("waits for the merge with the link, the passes and a way back in", async () => {
    const { user } = pane({
      status: "done",
      prNumber: 12,
      prUrl: "https://github.com/o/r/pull/12",
      prState: "open",
      reports: [
        { pass: 1, file: "web-review-1.md", clean: false },
        { pass: 2, file: "web-review-2.md", clean: true },
      ],
    });

    expect(
      screen.getByText("The pull request of web is waiting for the merge"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pass 1 · changes requested")).toBeInTheDocument();
    expect(screen.getByText("Pass 2 · nothing to change")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review again" }));
    await user.click(screen.getByRole("button", { name: "Refresh PR" }));

    expect(api.reviewAgain).toHaveBeenCalledWith("task-1", "/home/dev/projects/web");
    expect(api.refreshPR).toHaveBeenCalledWith("task-1", "/home/dev/projects/web");
  });

  it("says when the merge couldn't be confirmed", () => {
    pane({ status: "done", prNumber: 12, checkError: "gh: not authenticated" });

    expect(
      screen.getByText(
        "The merge couldn't be confirmed: gh: not authenticated. If you merged it, close the repository anyway.",
      ),
    ).toBeInTheDocument();
  });

  it("closes a merged repository and says what that does", async () => {
    const { user } = pane({
      status: "merged",
      canClose: true,
      prNumber: 12,
      prState: "merged",
      prBase: "main",
    });

    expect(screen.getByText("The pull request of web was merged")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Closing removes the worktree and the branch of the task and brings main up to date when that is a fast-forward. Nothing else in the repository is touched.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close repository" }));

    expect(api.closeRepo).toHaveBeenCalledWith("task-1", "/home/dev/projects/web");
  });

  it("sends the user back to GitHub when the pull request was closed without a merge", async () => {
    const { user } = pane({ status: "pr_closed", prNumber: 12, prState: "closed" });

    expect(
      screen.getByText("The pull request of web was closed without a merge"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh PR" }));

    expect(api.refreshPR).toHaveBeenCalledWith("task-1", "/home/dev/projects/web");
  });

  it("waits while the repository is being closed", () => {
    pane({ status: "closing" });

    expect(screen.getByRole("status")).toHaveTextContent("Closing the repository…");
  });

  it("reads back everything the closing did", () => {
    pane({ status: "closed", close: makeCloseResult() });

    expect(screen.getByText("web is closed")).toBeInTheDocument();
    expect(screen.getByText("Worktree removed")).toBeInTheDocument();
    expect(screen.getByText("Branch add-login deleted")).toBeInTheDocument();
    expect(screen.getByText("dev updated by 3 commits")).toBeInTheDocument();
  });

  it("names what the closing left on disk", () => {
    pane({
      status: "closed",
      close: makeCloseResult({
        worktree: { outcome: "failed", reason: "", detail: "permission denied" },
        branch: { outcome: "skipped", reason: "not_merged", detail: "add-login" },
        base: { outcome: "skipped", reason: "dirty", detail: "M src/main.tsx" },
      }),
    });

    expect(screen.getByText("Worktree couldn't be removed: permission denied")).toBeInTheDocument();
    expect(
      screen.getByText("Branch add-login kept: git doesn't see it merged into dev"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("dev not updated: the repository has uncommitted changes"),
    ).toBeInTheDocument();
    expect(screen.getByText("What stayed behind is yours to remove:")).toBeInTheDocument();
    expect(
      screen.getByText("/home/dev/.local/share/myspec/worktrees/add-login-web"),
    ).toBeInTheDocument();
  });

  it("names the branch the closing could not delete", () => {
    pane({
      status: "closed",
      close: makeCloseResult({
        branch: { outcome: "failed", reason: "", detail: "branch is checked out" },
      }),
    });

    expect(
      screen.getByText("Branch add-login couldn't be deleted: branch is checked out"),
    ).toBeInTheDocument();
    expect(screen.getByText("What stayed behind is yours to remove:")).toBeInTheDocument();
    expect(screen.getByText("add-login")).toBeInTheDocument();
  });

  it("summarises a closing whose record never arrived", () => {
    pane({ status: "closed", close: null });

    expect(screen.getByText("web is closed")).toBeInTheDocument();
    expect(screen.queryByText("Worktree removed")).not.toBeInTheDocument();
  });

  it("opens the pull request of a closed repository in the browser", async () => {
    const { user } = pane({
      status: "done",
      prNumber: 12,
      prUrl: "https://github.com/o/r/pull/12",
    });

    await user.click(screen.getByText("#12"));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/o/r/pull/12");
  });

  it("says a repository with no commits has nothing to propose, and offers the closing", async () => {
    const { user } = pane({ status: "skipped", canClose: true });

    expect(screen.getByText("No changes to open a pull request with")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Reply to the agent…")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close repository" }));

    expect(api.closeRepo).toHaveBeenCalledWith("task-1", "/home/dev/projects/web");
  });
});
