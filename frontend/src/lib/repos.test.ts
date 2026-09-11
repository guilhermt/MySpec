import { describe, expect, it } from "vitest";
import {
  closedCount,
  defaultRepoPath,
  everyRepoHasPR,
  everyRepoReviewed,
  repoAwaitsUser,
  repoName,
  reposOf,
} from "@/lib/repos";
import { makeRepoPR, makeState, makeTask } from "@/test/wails-mock";

const API = { repository: "api", repoPath: "/home/dev/projects/api", slug: "api" };

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

describe("reposOf", () => {
  it("is empty for a task outside the PR stage", () => {
    expect(reposOf(makeTask())).toEqual([]);
    expect(reposOf(null)).toEqual([]);
  });

  it("falls back to an empty list when the backend sends none", () => {
    expect(reposOf(makeTask({ repos: null }))).toEqual([]);
  });
});

describe("repoAwaitsUser", () => {
  it.each([
    ["blocked", true],
    ["draft_ready", true],
    ["awaiting_decision", true],
    ["in_review", true],
    ["ready_to_approve", true],
    ["preparing", false],
    ["drafting", false],
    ["opening", false],
    ["reviewing", false],
    ["committing", false],
    ["done", false],
    ["merged", true],
    ["pr_closed", false],
    ["closing", false],
    ["closed", false],
    ["skipped", false],
  ])("reads %s", (status, expected) => {
    expect(repoAwaitsUser(makeRepoPR({ status }))).toBe(expected);
  });

  it("waits for the user when the app could not confirm the merge", () => {
    expect(repoAwaitsUser(makeRepoPR({ status: "done", canClose: true }))).toBe(true);
  });
});

describe("defaultRepoPath", () => {
  it("is the first repository waiting for the user", () => {
    const repos = [
      makeRepoPR({ status: "reviewing" }),
      makeRepoPR({ ...API, status: "draft_ready" }),
    ];

    expect(defaultRepoPath(repos)).toBe(API.repoPath);
  });

  it("is the first of the list when none waits", () => {
    const repos = [makeRepoPR({ status: "reviewing" }), makeRepoPR({ ...API, status: "drafting" })];

    expect(defaultRepoPath(repos)).toBe(repos[0]?.repoPath);
  });

  it("is empty without repositories", () => {
    expect(defaultRepoPath([])).toBe("");
  });
});

describe("everyRepoHasPR", () => {
  it("is true once every repository that opens one has it", () => {
    expect(everyRepoHasPR([makeRepoPR({ prNumber: 12 })])).toBe(true);
  });

  it("is false while one is missing", () => {
    expect(everyRepoHasPR([makeRepoPR({ prNumber: 12 }), makeRepoPR(API)])).toBe(false);
  });

  it("ignores a repository that skipped the stage", () => {
    const repos = [makeRepoPR({ prNumber: 12 }), makeRepoPR({ ...API, status: "skipped" })];

    expect(everyRepoHasPR(repos)).toBe(true);
  });

  it("is false with nothing but skipped repositories, and with none at all", () => {
    expect(everyRepoHasPR([makeRepoPR({ status: "skipped" })])).toBe(false);
    expect(everyRepoHasPR([])).toBe(false);
  });
});

describe("everyRepoReviewed", () => {
  it("is true once every repository is through with its review", () => {
    const repos = [
      makeRepoPR({ status: "merged" }),
      makeRepoPR({ ...API, status: "closed" }),
      makeRepoPR({ repository: "docs", repoPath: "/home/dev/projects/docs", status: "skipped" }),
    ];

    expect(everyRepoReviewed(repos)).toBe(true);
  });

  it.each(["done", "merged", "pr_closed", "closing", "closed", "skipped"])(
    "counts %s as reviewed",
    (status) => {
      expect(everyRepoReviewed([makeRepoPR({ status })])).toBe(true);
    },
  );

  it("is false while one repository is still in the review", () => {
    const repos = [makeRepoPR({ status: "done" }), makeRepoPR({ ...API, status: "in_review" })];

    expect(everyRepoReviewed(repos)).toBe(false);
  });

  it("is false without repositories", () => {
    expect(everyRepoReviewed([])).toBe(false);
  });
});

describe("closedCount", () => {
  it("counts the repositories the user has closed", () => {
    const repos = [makeRepoPR({ status: "closed" }), makeRepoPR({ ...API, status: "merged" })];

    expect(closedCount(repos)).toBe(1);
    expect(closedCount([])).toBe(0);
  });
});
