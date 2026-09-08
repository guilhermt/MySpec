import { describe, expect, it } from "vitest";
import { defaultRepoPath, everyRepoHasPR, repoAwaitsUser, reposOf } from "@/lib/repos";
import { makeRepoPR, makeTask } from "@/test/wails-mock";

const API = { repository: "api", repoPath: "/home/dev/projects/api", slug: "api" };

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
    ["skipped", false],
  ])("reads %s", (status, expected) => {
    expect(repoAwaitsUser(makeRepoPR({ status }))).toBe(expected);
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
