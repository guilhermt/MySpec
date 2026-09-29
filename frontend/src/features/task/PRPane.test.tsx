import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PRPane } from "@/features/task/PRPane";
import { api, type PullRequest, type Situation } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makeCloseResult,
  makePullRequest,
  makeRepository,
  makeReview,
  makeSituation,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const DRAFT = { title: "Add the login form", body: "Closes #12", file: "draft.md" };

// onPR is the situation of the pull request the request bar is drawn from.
const onPR = (kind: string, form = "") =>
  makeSituation({ kind, form, place: { kind: "pr", stage: "", step: 0 } });

function pane(
  overrides: Partial<PullRequest> = {},
  repositories = [makeRepository()],
  situations: Situation[] = [],
) {
  const pr = makePullRequest(overrides);
  const task = makeTask({ stage: "pr", pr, situations });
  return renderWithStore(<PRPane task={task} pr={pr} tab="implementer" />, {
    state: makeState({ repositories, tasks: [task] }),
    ui: {
      transcripts: {
        "task-1|pr": { status: "ready", error: "", entries: [], pending: [], buffered: [] },
        "task-1|pr_review": { status: "ready", error: "", entries: [], pending: [], buffered: [] },
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

  it("puts the draft above the conversation once it is ready, and its approval in the bar", () => {
    pane({ status: "draft_ready", draft: DRAFT, sessionStage: "pr" }, undefined, [onPR("draft")]);

    expect(screen.getByLabelText("Title")).toHaveValue(DRAFT.title);
    expect(screen.getByPlaceholderText("Reply to the agent…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open PR" })).not.toBeInTheDocument();
    const bar = screen.getByRole("region", { name: "Request" });
    expect(within(bar).getByRole("button", { name: "Approve draft" })).toBeInTheDocument();
  });

  it("keeps the draft above the conversation after an opening that failed", () => {
    pane({ status: "awaiting_reply", draft: DRAFT });

    expect(screen.getByLabelText("Title")).toHaveValue(DRAFT.title);
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

  it("waits for the merge with the link and the passes, the bar below the note", () => {
    pane(
      {
        status: "done",
        prNumber: 12,
        prUrl: "https://github.com/o/r/pull/12",
        prState: "open",
        reports: [
          { pass: 1, file: "review-1.md", clean: false },
          { pass: 2, file: "review-2.md", clean: true },
        ],
      },
      undefined,
      [onPR("merge", "merge")],
    );

    expect(screen.getByText("The pull request is waiting for the merge")).toBeInTheDocument();
    expect(screen.getByText("Pass 1 · changes requested")).toBeInTheDocument();
    expect(screen.getByText("Pass 2 · nothing to change")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    // Review again and Refresh PR are in the ⋯; the note keeps only its text and the link.
    expect(screen.queryByRole("button", { name: "Review again" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh PR" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Request" })).toHaveTextContent("Ready to merge");
  });

  it("lists what went wrong after the review, with no buttons of its own", () => {
    pane({
      status: "trouble",
      prNumber: 12,
      prState: "open",
      prBase: "main",
      trouble: { failedChecks: ["ci", "lint"], conflict: true },
    });

    expect(screen.getByText("The pull request is no longer ready to merge")).toBeInTheDocument();
    expect(screen.getByText("Check failed: ci")).toBeInTheDocument();
    expect(screen.getByText("Check failed: lint")).toBeInTheDocument();
    expect(screen.getByText("Conflict with main")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review again" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh PR" })).not.toBeInTheDocument();
  });

  it("names the base of the worktree when the conflict is all that went wrong", () => {
    pane({
      status: "trouble",
      prNumber: 12,
      baseBranch: "origin/dev",
      trouble: { failedChecks: [], conflict: true },
    });

    expect(screen.getByText("Conflict with dev")).toBeInTheDocument();
    expect(screen.queryByText(/Check failed/)).not.toBeInTheDocument();
  });

  it("says what closing a merged task does, the closing in the bar", async () => {
    const { user } = pane(
      {
        status: "merged",
        canClose: true,
        prNumber: 12,
        prState: "merged",
        prBase: "main",
      },
      undefined,
      [onPR("merge", "close")],
    );

    expect(screen.getByText("The pull request was merged")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Closing removes the worktree and the branch of the task and brings main up to date when that is a fast-forward. Nothing else in the repository is touched.",
      ),
    ).toBeInTheDocument();

    const bar = screen.getByRole("region", { name: "Request" });
    await user.click(within(bar).getByRole("button", { name: "Close task" }));

    expect(api.closeTask).toHaveBeenCalledWith("task-1");
  });

  it("offers no closing while the clone of the repository is missing", () => {
    // The Go side refuses the closing while the clone is missing, however
    // merged the pull request is.
    pane(
      { status: "merged", prNumber: 12, cloneMissing: true, canClose: false },
      [makeRepository({ missing: true })],
      [onPR("merge", "close")],
    );

    expect(screen.getByRole("button", { name: /^Close task/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    const note = screen.getByText("The pull request was merged").parentElement as HTMLElement;
    expect(within(note).getByText("The clone at /home/dev/projects/web is missing.")).toBeVisible();
  });

  it("sends the user back to GitHub when the pull request was closed without a merge", () => {
    pane({ status: "pr_closed", prNumber: 12, prState: "closed" }, undefined, [onPR("pr_closed")]);

    expect(screen.getByText("The pull request was closed without a merge")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh PR" })).not.toBeInTheDocument();
    const bar = screen.getByRole("region", { name: "Request" });
    expect(within(bar).getByRole("button", { name: "Delete task…" })).toBeInTheDocument();
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
