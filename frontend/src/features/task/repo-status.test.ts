import { describe, expect, it } from "vitest";
import {
  approveRepoHint,
  canApproveRepo,
  canDiscardDraft,
  canOpenPR,
  canReviewAgain,
  hasRepoSession,
  prBlockHint,
  prBlockTitle,
  prReportLabel,
  prStateLabel,
  repoName,
  repoStatusLabel,
  repoStatusTone,
} from "@/features/task/repo-status";
import { makeRepoPR, makeReview, makeState } from "@/test/wails-mock";

describe("repoName", () => {
  it("is the path the plan gave the repository", () => {
    expect(repoName(makeState(), makeRepoPR({ repository: "web" }))).toBe("web");
  });

  it("is the name of the workspace for the repository that is the workspace", () => {
    expect(repoName(makeState(), makeRepoPR({ repository: "." }))).toBe("projects");
  });

  it("falls back to Root without a workspace to name", () => {
    expect(repoName(null, makeRepoPR({ repository: "." }))).toBe("Root");
  });
});

describe("repoStatusLabel and repoStatusTone", () => {
  it.each([
    ["preparing", "Checking GitHub", "working"],
    ["blocked", "Blocked", "attention"],
    ["drafting", "Preparing the draft", "working"],
    ["draft_ready", "Draft waiting for your OK", "attention"],
    ["opening", "Opening the pull request", "working"],
    ["reviewing", "Reviewing the pull request", "working"],
    ["awaiting_decision", "Waiting for your decision", "attention"],
    ["in_review", "In review", "attention"],
    ["ready_to_approve", "Ready to approve", "attention"],
    ["committing", "Committing", "working"],
    ["done", "Waiting to be closed", "done"],
    ["skipped", "No changes", "done"],
  ])("reads %s", (status, label, tone) => {
    const repo = makeRepoPR({ status });

    expect(repoStatusLabel(repo)).toBe(label);
    expect(repoStatusTone(repo)).toBe(tone);
  });
});

describe("what a repository allows", () => {
  it("opens the pull request only from a ready draft the agent is not touching", () => {
    expect(canOpenPR(makeRepoPR({ status: "draft_ready" }))).toBe(true);
    expect(canOpenPR(makeRepoPR({ status: "draft_ready", turnRunning: true }))).toBe(false);
    expect(canOpenPR(makeRepoPR({ status: "drafting" }))).toBe(false);
  });

  it("approves only with everything staged", () => {
    expect(canApproveRepo(makeRepoPR({ status: "ready_to_approve" }))).toBe(true);
    expect(canApproveRepo(makeRepoPR({ status: "in_review" }))).toBe(false);
  });

  it("throws the draft away only while it is still a proposal", () => {
    expect(canDiscardDraft(makeRepoPR({ status: "drafting" }))).toBe(true);
    expect(canDiscardDraft(makeRepoPR({ status: "draft_ready" }))).toBe(true);
    expect(canDiscardDraft(makeRepoPR({ status: "reviewing" }))).toBe(false);
  });

  it("reviews again from every state the pull request exists in", () => {
    expect(canReviewAgain(makeRepoPR({ status: "awaiting_decision" }))).toBe(true);
    expect(canReviewAgain(makeRepoPR({ status: "done" }))).toBe(true);
    expect(canReviewAgain(makeRepoPR({ status: "draft_ready" }))).toBe(false);
  });

  it("has a conversation only once a session was opened for it", () => {
    expect(hasRepoSession(makeRepoPR())).toBe(true);
    expect(hasRepoSession(makeRepoPR({ sessionStage: "" }))).toBe(false);
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
    ["no_worktree", "The worktree is gone", "Discard the plan"],
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

describe("approveRepoHint", () => {
  it("says what is missing", () => {
    expect(approveRepoHint(makeRepoPR({ review: makeReview() }))).toContain("Stage every changed");
    expect(approveRepoHint(makeRepoPR({ review: makeReview({ error: "boom" }) }))).toBe(
      "The worktree couldn't be read",
    );
  });
});
