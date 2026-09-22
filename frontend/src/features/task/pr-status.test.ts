import { describe, expect, it } from "vitest";
import {
  approvePRHint,
  canApprovePR,
  canCloseTask,
  canDiscardDraft,
  canOpenPR,
  canReviewAgain,
  closeHint,
  closeStepLabel,
  draftAtHand,
  hasPRSession,
  prBlockHint,
  prBlockTitle,
  prReportLabel,
  prStateLabel,
  prStatusLabel,
  prStatusTone,
} from "@/features/task/pr-status";
import { makeCloseResult, makePullRequest, makeRepository, makeReview } from "@/test/wails-mock";

const DRAFT = { title: "Add the login form", body: "Adds the form.", file: "draft.md" };

describe("prStatusLabel and prStatusTone", () => {
  it.each([
    ["preparing", "Checking GitHub", "working"],
    ["blocked", "Blocked", "idle"],
    ["drafting", "Preparing the draft", "working"],
    ["draft_ready", "Draft waiting for your OK", "idle"],
    ["awaiting_reply", "Waiting for your reply", "idle"],
    ["opening", "Opening the pull request", "working"],
    ["reviewing", "Reviewing the pull request", "working"],
    ["waiting_checks", "Waiting for checks", "working"],
    ["awaiting_decision", "Waiting for your decision", "idle"],
    ["in_review", "In review", "idle"],
    ["ready_to_approve", "Ready to approve", "idle"],
    ["committing", "Committing", "working"],
    ["done", "Waiting for the merge", "idle"],
    ["merged", "Merged · ready to close", "idle"],
    ["pr_closed", "Closed without merge", "idle"],
    ["closing", "Closing", "working"],
    ["closed", "Closed", "done"],
  ])("reads %s", (status, label, tone) => {
    const pr = makePullRequest({ status });

    expect(prStatusLabel(pr)).toBe(label);
    expect(prStatusTone(pr)).toBe(tone);
  });

  it("leaves a merge it could not confirm to the situation of the task", () => {
    const pr = makePullRequest({ status: "done", canClose: true, checkError: "gh: not found" });

    expect(prStatusTone(pr)).toBe("idle");
  });
});

describe("what the pull request allows", () => {
  it("opens the pull request only from a ready draft the agent is not touching", () => {
    expect(canOpenPR(makePullRequest({ status: "draft_ready" }))).toBe(true);
    expect(canOpenPR(makePullRequest({ status: "draft_ready", turnRunning: true }))).toBe(false);
    expect(canOpenPR(makePullRequest({ status: "drafting" }))).toBe(false);
  });

  it("opens the pull request again from the draft an opening that failed left", () => {
    expect(canOpenPR(makePullRequest({ status: "awaiting_reply", draft: DRAFT }))).toBe(true);
    expect(
      canOpenPR(makePullRequest({ status: "awaiting_reply", draft: DRAFT, turnRunning: true })),
    ).toBe(false);
    expect(canOpenPR(makePullRequest({ status: "awaiting_reply" }))).toBe(false);
  });

  it("has the draft at hand only while it is ready or left by an opening that failed", () => {
    expect(draftAtHand(makePullRequest({ status: "draft_ready" }))).toBe(true);
    // The agent is in a turn: the draft is still at hand, only not sendable yet.
    expect(draftAtHand(makePullRequest({ status: "draft_ready", turnRunning: true }))).toBe(true);
    expect(draftAtHand(makePullRequest({ status: "awaiting_reply", draft: DRAFT }))).toBe(true);
    expect(draftAtHand(makePullRequest({ status: "awaiting_reply" }))).toBe(false);
    expect(draftAtHand(makePullRequest({ status: "drafting", draft: DRAFT }))).toBe(false);
    expect(draftAtHand(makePullRequest({ status: "reviewing", draft: DRAFT, prNumber: 12 }))).toBe(
      false,
    );
  });

  it("keeps the draft a record while the agent waits for a reply over an open pull request", () => {
    const repo = makePullRequest({ status: "awaiting_reply", draft: DRAFT, prNumber: 12 });

    expect(draftAtHand(repo)).toBe(false);
    expect(canOpenPR(repo)).toBe(false);
  });

  it("approves only with everything staged", () => {
    expect(canApprovePR(makePullRequest({ status: "ready_to_approve" }))).toBe(true);
    expect(canApprovePR(makePullRequest({ status: "in_review" }))).toBe(false);
  });

  it("throws the draft away only while it is still a proposal", () => {
    expect(canDiscardDraft(makePullRequest({ status: "drafting" }))).toBe(true);
    expect(canDiscardDraft(makePullRequest({ status: "draft_ready" }))).toBe(true);
    expect(canDiscardDraft(makePullRequest({ status: "reviewing" }))).toBe(false);
    expect(canDiscardDraft(makePullRequest({ status: "waiting_checks" }))).toBe(false);
  });

  it("throws the draft away while the agent waits for a reply before the pull request", () => {
    expect(canDiscardDraft(makePullRequest({ status: "awaiting_reply" }))).toBe(true);
    expect(canDiscardDraft(makePullRequest({ status: "awaiting_reply", prNumber: 12 }))).toBe(
      false,
    );
  });

  it("reviews again from every state the pull request exists in", () => {
    expect(canReviewAgain(makePullRequest({ status: "awaiting_decision" }))).toBe(true);
    expect(canReviewAgain(makePullRequest({ status: "done" }))).toBe(true);
    expect(canReviewAgain(makePullRequest({ status: "merged" }))).toBe(true);
    expect(canReviewAgain(makePullRequest({ status: "draft_ready" }))).toBe(false);
    expect(canReviewAgain(makePullRequest({ status: "waiting_checks", prNumber: 12 }))).toBe(false);
    expect(canReviewAgain(makePullRequest({ status: "pr_closed" }))).toBe(false);
    expect(canReviewAgain(makePullRequest({ status: "closing" }))).toBe(false);
    expect(canReviewAgain(makePullRequest({ status: "closed" }))).toBe(false);
  });

  it("reviews again while the agent waits for a reply over an open pull request", () => {
    expect(canReviewAgain(makePullRequest({ status: "awaiting_reply", prNumber: 12 }))).toBe(true);
    expect(canReviewAgain(makePullRequest({ status: "awaiting_reply" }))).toBe(false);
  });

  it("closes only when the backend says the closing is the user's to ask for", () => {
    expect(canCloseTask(makePullRequest({ status: "merged", canClose: true }))).toBe(true);
    expect(canCloseTask(makePullRequest({ status: "done" }))).toBe(false);
    // The closing is already under way; asking again would do nothing.
    expect(canCloseTask(makePullRequest({ status: "closing", canClose: true }))).toBe(false);
  });

  it("has a conversation only once a session was opened for it", () => {
    expect(hasPRSession(makePullRequest())).toBe(true);
    expect(hasPRSession(makePullRequest({ sessionStage: "" }))).toBe(false);
  });
});

describe("closeHint", () => {
  it("says why the task can't be closed yet", () => {
    expect(closeHint(makePullRequest({ status: "done" }), null)).toBe(
      "The pull request hasn't been merged yet",
    );
    expect(closeHint(makePullRequest({ status: "pr_closed" }), null)).toBe(
      "The pull request was closed without a merge",
    );
    expect(closeHint(makePullRequest({ status: "merged" }), null)).toBe("");
  });

  it("names the clone the closing waits for before anything else", () => {
    const repository = makeRepository({ missing: true });
    const pr = makePullRequest({ status: "merged", cloneMissing: true });

    expect(closeHint(pr, repository)).toBe("The clone at /home/dev/projects/web is missing.");
  });
});

describe("closeStepLabel", () => {
  it("reads what became of the worktree", () => {
    expect(closeStepLabel("worktree", makeCloseResult())).toBe("Worktree removed");
    expect(
      closeStepLabel(
        "worktree",
        makeCloseResult({ worktree: { outcome: "skipped", reason: "missing", detail: "" } }),
      ),
    ).toBe("Worktree was already gone");
    expect(
      closeStepLabel(
        "worktree",
        makeCloseResult({
          worktree: { outcome: "failed", reason: "", detail: "permission denied" },
        }),
      ),
    ).toBe("Worktree couldn't be removed: permission denied");
  });

  it("reads what became of the branch", () => {
    expect(closeStepLabel("branch", makeCloseResult())).toBe("Branch add-login deleted");
    expect(
      closeStepLabel(
        "branch",
        makeCloseResult({ branch: { outcome: "skipped", reason: "missing", detail: "" } }),
      ),
    ).toBe("Branch add-login was already gone");
    expect(
      closeStepLabel(
        "branch",
        makeCloseResult({ branch: { outcome: "skipped", reason: "not_merged", detail: "" } }),
      ),
    ).toBe("Branch add-login kept: git doesn't see it merged into dev");
    expect(
      closeStepLabel(
        "branch",
        makeCloseResult({ branch: { outcome: "failed", reason: "", detail: "git said no" } }),
      ),
    ).toBe("Branch add-login couldn't be deleted: git said no");
  });

  it("counts the commits the base branch moved by", () => {
    expect(closeStepLabel("base", makeCloseResult())).toBe("dev updated by 3 commits");
    expect(closeStepLabel("base", makeCloseResult({ baseCommits: 1 }))).toBe(
      "dev updated by 1 commit",
    );
  });

  it.each([
    ["missing", "dev not updated: the branch doesn't exist locally"],
    ["not_checked_out", "dev not updated: another branch is checked out"],
    ["dirty", "dev not updated: the repository has uncommitted changes"],
    ["no_upstream", "dev not updated: it tracks no remote branch"],
    ["diverged", "dev not updated: it has commits the remote doesn't"],
    ["up_to_date", "dev was already up to date"],
  ])("says why the base was left alone: %s", (reason, expected) => {
    const result = makeCloseResult({ base: { outcome: "skipped", reason, detail: "" } });

    expect(closeStepLabel("base", result)).toBe(expected);
  });

  it("reports what git said when the base could not be updated", () => {
    const result = makeCloseResult({
      base: { outcome: "failed", reason: "", detail: "fetch failed" },
    });

    expect(closeStepLabel("base", result)).toBe("dev not updated: fetch failed");
  });
});

describe("prStateLabel", () => {
  it.each([
    ["open", "Open"],
    ["merged", "Merged"],
    ["closed", "Closed"],
    ["", ""],
    ["draft", ""],
  ])("reads %s", (state, expected) => {
    expect(prStateLabel(state as never)).toBe(expected);
  });
});

describe("prBlockTitle and prBlockHint", () => {
  it.each([
    ["gh_missing", "GitHub CLI was not found", "PATH"],
    ["gh_unauthenticated", "GitHub CLI isn't authenticated", "gh auth login"],
    ["gh_failed", "GitHub CLI failed", "gh reports"],
    ["git_failed", "Git failed", "git reports"],
    ["no_worktree", "The worktree is gone", "worktree of this task"],
  ] as const)("names %s", (reason, title, hint) => {
    expect(prBlockTitle(reason)).toBe(title);
    expect(prBlockHint(reason)).toContain(hint);
  });
});

describe("prReportLabel", () => {
  it("says how a pass closed", () => {
    expect(prReportLabel(1, false)).toBe("Pass 1 · changes requested");
    expect(prReportLabel(2, true)).toBe("Pass 2 · nothing to change");
  });
});

describe("approvePRHint", () => {
  it("says what is missing", () => {
    expect(approvePRHint(makePullRequest({ review: makeReview() }))).toContain(
      "Stage every changed",
    );
    expect(approvePRHint(makePullRequest({ review: makeReview({ error: "boom" }) }))).toBe(
      "The worktree couldn't be read",
    );
  });
});
