import { describe, expect, it } from "vitest";
import { divergenceActions, divergenceText } from "@/lib/divergences";
import type { Divergence, DivergentPR } from "@/lib/wails";
import { makeDivergence } from "@/test/wails-mock";

const pr = (number: number, fields: Partial<DivergentPR> = {}): DivergentPR => ({
  number,
  url: `https://github.com/acme/web/pull/${number}`,
  base: "main",
  head: "feature/login",
  ...fields,
});

const REPORT = "the report of pass 2 at step-reviews/step-3-pass-2.md";

describe("divergenceText", () => {
  it.each<[string, Partial<Divergence>, string, string]>([
    [
      "a commit missing with changes",
      { kind: "commit_missing", branch: "feature/login", commit: "abc1234", files: 4 },
      "a commit on feature/login after abc1234",
      "no commit, and 4 files changed in the worktree",
    ],
    [
      "a commit missing with one file changed",
      { kind: "commit_missing", branch: "feature/login", commit: "abc1234", files: 1 },
      "a commit on feature/login after abc1234",
      "no commit, and 1 file changed in the worktree",
    ],
    [
      "a commit missing with a clean worktree",
      { kind: "commit_missing", branch: "feature/login", commit: "abc1234", files: 0 },
      "a commit on feature/login after abc1234",
      "no commit, and the worktree has no changes",
    ],
    [
      "a report missing",
      { kind: "report_missing", pass: 2, path: "step-reviews/step-3-pass-2.md" },
      REPORT,
      "no report",
    ],
    [
      "a report that can't be read",
      {
        kind: "report_unreadable",
        pass: 2,
        path: "step-reviews/step-3-pass-2.md",
        reason: "The report can't be read: finding 2 has no location.",
      },
      REPORT,
      "a report that can't be read: finding 2 has no location",
    ],
    [
      "reports that could be it",
      {
        kind: "reports_ambiguous",
        pass: 2,
        path: "step-reviews/step-3-pass-2.md",
        candidates: ["a/one.md", "b/two.md"],
      },
      REPORT,
      "2 files that could be it: a/one.md, b/two.md",
    ],
    [
      "a draft missing",
      { kind: "draft_missing", path: "pr/draft.md" },
      "the draft of the pull request at pr/draft.md",
      "no draft",
    ],
    [
      "a draft that can't be read",
      { kind: "draft_unreadable", path: "pr/draft.md", reason: "The title is empty." },
      "the draft of the pull request at pr/draft.md",
      "a draft that can't be read: The title is empty",
    ],
    [
      "no changes for several findings",
      { kind: "no_changes", approved: 3, pass: 2 },
      "changes for the 3 approved findings of pass 2",
      "no file changed",
    ],
    [
      "no changes for one finding",
      { kind: "no_changes", approved: 1, pass: 2 },
      "changes for the approved finding of pass 2",
      "no file changed",
    ],
    [
      "a pull request into another base",
      { kind: "pr_wrong_base", base: "dev", prs: [pr(12, { base: "main" })] },
      "a pull request into dev",
      "#12 into main",
    ],
    [
      "a pull request of another branch",
      { kind: "pr_other_branch", branch: "feature/login", prs: [pr(12, { head: "other" })] },
      "a pull request from feature/login",
      "#12 from other, with the head of the task",
    ],
    [
      "two pull requests",
      { kind: "prs_ambiguous", branch: "feature/login", prs: [pr(12), pr(14)] },
      "one pull request from feature/login",
      "#12 and #14",
    ],
    [
      "three pull requests",
      { kind: "prs_ambiguous", branch: "feature/login", prs: [pr(12), pr(14), pr(15)] },
      "one pull request from feature/login",
      "#12, #14 and #15",
    ],
    [
      "a pull request not opened",
      { kind: "pr_not_opened", base: "main" },
      "the pull request into main, approved in the draft",
      "none on GitHub",
    ],
    [
      "a push rejected",
      { kind: "push_rejected", branch: "feature/login", commit: "abc1234" },
      "feature/login on origin with abc1234",
      "origin has commits feature/login doesn't",
    ],
    [
      "drafts that can't be read",
      { kind: "drafts_unreadable", reason: "No draft has a title." },
      "drafts.md in the format of the discussion",
      "No draft has a title",
    ],
  ])("says %s", (_name, fields, expected, found) => {
    expect(divergenceText(makeDivergence(fields))).toEqual({ expected, found });
  });
});

describe("divergenceActions", () => {
  const labels = (fields: Partial<Divergence>) =>
    divergenceActions(makeDivergence(fields)).map((action) => action.label);

  it.each<[string, Partial<Divergence>, string[]]>([
    [
      "a commit missing",
      { kind: "commit_missing", stage: "step:3" },
      ["Ask the agent again", "Check again"],
    ],
    [
      "the commit of a pull request review",
      { kind: "commit_missing", stage: "pr_fix" },
      ["Ask the implementer again", "Check again"],
    ],
    [
      "a report missing",
      { kind: "report_missing", stage: "step_review:3" },
      ["Ask the reviewer again", "Check again"],
    ],
    [
      "a report that can't be read",
      { kind: "report_unreadable", stage: "review" },
      ["Ask the reviewer again", "Check again"],
    ],
    [
      "a draft missing",
      { kind: "draft_missing", stage: "pr" },
      ["Ask the agent again", "Check again"],
    ],
    [
      "drafts that can't be read",
      { kind: "drafts_unreadable", stage: "discussion" },
      ["Ask the agent again", "Check again"],
    ],
    [
      "no changes",
      { kind: "no_changes", stage: "review" },
      ["Continue without changes", "Ask the implementer again", "Check again"],
    ],
    [
      "reports that could be it",
      { kind: "reports_ambiguous", candidates: ["a/one.md", "b/two.md"] },
      ["Adopt one.md", "Adopt two.md", "Check again"],
    ],
    [
      "a pull request of another base",
      { kind: "pr_wrong_base", prs: [pr(12)] },
      ["Adopt #12", "Check again"],
    ],
    [
      "pull requests that could be it",
      { kind: "prs_ambiguous", prs: [pr(12), pr(14)] },
      ["Adopt #12", "Adopt #14", "Check again"],
    ],
    [
      "a pull request not opened",
      { kind: "pr_not_opened" },
      ["Open the pull request", "Check again"],
    ],
    ["a push rejected", { kind: "push_rejected" }, ["Try the push again"]],
  ])("lists the ways out of %s", (_name, fields, expected) => {
    expect(labels(fields)).toEqual(expected);
  });

  it("carries what an adoption takes", () => {
    expect(
      divergenceActions(makeDivergence({ kind: "prs_ambiguous", prs: [pr(12), pr(14)] })),
    ).toMatchObject([
      { kind: "adopt", choice: "12" },
      { kind: "adopt", choice: "14" },
      { kind: "checkAgain" },
    ]);
    expect(
      divergenceActions(makeDivergence({ kind: "reports_ambiguous", candidates: ["a/one.md"] })),
    ).toMatchObject([{ kind: "adopt", choice: "a/one.md" }, { kind: "checkAgain" }]);
    expect(divergenceActions(makeDivergence({ kind: "no_changes" }))[0]).toMatchObject({
      kind: "adopt",
      choice: "",
    });
  });
});
