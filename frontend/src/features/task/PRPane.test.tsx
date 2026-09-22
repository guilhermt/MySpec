import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PRPane } from "@/features/task/PRPane";
import { api, type PullRequest } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makeCloseResult,
  makePullRequest,
  makeRepository,
  makeReview,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const DRAFT = { title: "Add the login form", body: "Closes #12", file: "draft.md" };

function pane(overrides: Partial<PullRequest> = {}, repositories = [makeRepository()]) {
  const pr = makePullRequest(overrides);
  const task = makeTask({ stage: "pr", pr });
  return renderWithStore(<PRPane task={task} pr={pr} />, {
    state: makeState({ repositories, tasks: [task] }),
    ui: {
      transcripts: {
        "task-1|pr": { status: "ready", entries: [], pending: [], buffered: [] },
        "task-1|pr_review": { status: "ready", entries: [], pending: [], buffered: [] },
      },
    },
  });
}

describe("PRPane", () => {
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

  it("keeps the draft above the conversation after an opening that failed", () => {
    pane({ status: "awaiting_reply", draft: DRAFT });

    expect(screen.getByLabelText("Title")).toHaveValue(DRAFT.title);
    // Trying again needs no message to the agent first.
    expect(screen.getByRole("button", { name: "Open PR" })).toBeEnabled();
    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
  });

  it("is the conversation alone while the agent waits for a reply without a draft", () => {
    pane({ status: "awaiting_reply" });

    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("is the conversation alone while the agent owes the report of a review pass", () => {
    pane({
      status: "awaiting_reply",
      draft: DRAFT,
      prNumber: 12,
      sessionStage: "pr_review",
    });

    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("says the pull request is being opened", () => {
    pane({ status: "opening", draft: DRAFT });

    expect(screen.getByText("Opening the pull request…")).toBeInTheDocument();
  });

  it("is the conversation alone while the agent reviews", () => {
    pane({ status: "reviewing", prNumber: 12, sessionStage: "pr_review" });

    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("waits for the checks before the first pass has a conversation", () => {
    pane({ status: "waiting_checks", prNumber: 12, sessionStage: "" });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Waiting for the checks of the pull request…",
    );
    expect(screen.queryByPlaceholderText("Reply to the agent…")).not.toBeInTheDocument();
  });

  it("keeps the conversation while a later pass waits for the checks", () => {
    pane({ status: "waiting_checks", prNumber: 12, sessionStage: "pr_review" });

    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
  });

  it("puts the review strip above the conversation once changes are applied", () => {
    pane({
      status: "in_review",
      prNumber: 12,
      sessionStage: "pr_review",
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
        { pass: 1, file: "review-1.md", clean: false },
        { pass: 2, file: "review-2.md", clean: true },
      ],
    });

    expect(screen.getByText("The pull request is waiting for the merge")).toBeInTheDocument();
    expect(screen.getByText("Pass 1 · changes requested")).toBeInTheDocument();
    expect(screen.getByText("Pass 2 · nothing to change")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review again" }));
    await user.click(screen.getByRole("button", { name: "Refresh PR" }));

    expect(api.reviewAgain).toHaveBeenCalledWith("task-1");
    expect(api.refreshPR).toHaveBeenCalledWith("task-1");
  });

  it("says when the merge couldn't be confirmed", () => {
    pane({ status: "done", prNumber: 12, checkError: "gh: not authenticated" });

    expect(
      screen.getByText(
        "The merge couldn't be confirmed: gh: not authenticated. If you merged it, close the task anyway.",
      ),
    ).toBeInTheDocument();
  });

  it("closes a merged task and says what that does", async () => {
    const { user } = pane({
      status: "merged",
      canClose: true,
      prNumber: 12,
      prState: "merged",
      prBase: "main",
    });

    expect(screen.getByText("The pull request was merged")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Closing removes the worktree and the branch of the task and brings main up to date when that is a fast-forward. Nothing else in the repository is touched.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close task" }));

    expect(api.closeTask).toHaveBeenCalledWith("task-1");
  });

  it("offers no closing while the clone of the repository is missing", () => {
    // The Go side refuses the closing while the clone is missing, however
    // merged the pull request is.
    pane({ status: "merged", prNumber: 12, cloneMissing: true, canClose: false }, [
      makeRepository({ missing: true }),
    ]);

    expect(screen.getByRole("button", { name: "Close task" })).toBeDisabled();
    expect(screen.getByText("The clone at /home/dev/projects/web is missing.")).toBeInTheDocument();
  });

  it("sends the user back to GitHub when the pull request was closed without a merge", async () => {
    const { user } = pane({ status: "pr_closed", prNumber: 12, prState: "closed" });

    expect(screen.getByText("The pull request was closed without a merge")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh PR" }));

    expect(api.refreshPR).toHaveBeenCalledWith("task-1");
  });

  it("waits while the task is being closed", () => {
    pane({ status: "closing" });

    expect(screen.getByRole("status")).toHaveTextContent("Closing the task…");
  });

  it("reads back everything the closing did", () => {
    pane({ status: "closed", close: makeCloseResult() });

    expect(screen.getByText("The task is closed")).toBeInTheDocument();
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
      screen.getByText("/home/dev/.local/share/myspec/worktrees/dev/web/add-login"),
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

    expect(screen.getByText("The task is closed")).toBeInTheDocument();
    expect(screen.queryByText("Worktree removed")).not.toBeInTheDocument();
  });

  it("opens the pull request in the browser", async () => {
    const { user } = pane({
      status: "done",
      prNumber: 12,
      prUrl: "https://github.com/o/r/pull/12",
    });

    await user.click(screen.getByText("#12"));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/o/r/pull/12");
  });
});
