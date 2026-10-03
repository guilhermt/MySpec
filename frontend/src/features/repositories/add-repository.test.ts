import { describe, expect, it } from "vitest";
import {
  addLabel,
  filterCandidates,
  linksAClone,
  NO_CANDIDATES_TEXT,
  partition,
  SCANNING_TEXT,
} from "@/features/repositories/add-repository";
import { makeRepository, makeRepositoryCandidate } from "@/test/wails-mock";

const web = makeRepositoryCandidate();
const api = makeRepositoryCandidate({
  name: "api",
  fullName: "acme/api",
  owner: "acme",
  path: "/home/dev/work/Backend",
});

describe("filterCandidates", () => {
  it("keeps every candidate for an empty query", () => {
    const candidates = [web, api];

    expect(filterCandidates(candidates, "")).toBe(candidates);
    expect(filterCandidates(candidates, "   ")).toBe(candidates);
  });

  it("matches the name or the path, ignoring case", () => {
    expect(filterCandidates([web, api], "ACME/")).toEqual([api]);
    expect(filterCandidates([web, api], " backend ")).toEqual([api]);
    expect(filterCandidates([web, api], "projects")).toEqual([web]);
    expect(filterCandidates([web, api], "nothing")).toEqual([]);
  });
});

describe("addLabel", () => {
  it("counts the repositories only when there are several", () => {
    expect(addLabel(0)).toBe("Add repository");
    expect(addLabel(1)).toBe("Add repository");
    expect(addLabel(3)).toBe("Add 3 repositories");
  });
});

describe("partition", () => {
  it("puts the clones to register first and the registered after, each alphabetical", () => {
    const zed = makeRepositoryCandidate({ fullName: "acme/Zed", path: "/home/dev/zed" });
    const apiDone = makeRepositoryCandidate({
      fullName: "acme/api",
      path: "/home/dev/api",
      registered: true,
    });
    const docsDone = makeRepositoryCandidate({
      fullName: "Acme/docs",
      path: "/home/dev/docs",
      registered: true,
    });

    expect(partition([docsDone, zed, web, apiDone])).toEqual({
      available: [zed, web],
      registered: [apiDone, docsDone],
    });
  });

  it("tells two clones of one repository apart by path", () => {
    const second = makeRepositoryCandidate({ path: "/home/dev/other/web" });

    expect(partition([web, second]).available).toEqual([second, web]);
  });

  it("answers two empty groups for nothing", () => {
    expect(partition([])).toEqual({ available: [], registered: [] });
  });
});

describe("linksAClone", () => {
  it("is true for a repository registered without a clone, ignoring case", () => {
    const withoutClone = makeRepository({ fullName: "Dev/Web", cloned: false });

    expect(linksAClone(web, [withoutClone])).toBe(true);
  });

  it("is false for a cloned repository, another repository and no repositories", () => {
    expect(linksAClone(web, [makeRepository({ fullName: "dev/web", cloned: true })])).toBe(false);
    expect(linksAClone(web, [makeRepository({ fullName: "dev/api", cloned: false })])).toBe(false);
    expect(linksAClone(web, [])).toBe(false);
  });
});

describe("texts", () => {
  it("say what the scan does", () => {
    expect(SCANNING_TEXT).toBe("Scanning your home folder…");
    expect(NO_CANDIDATES_TEXT).toBe(
      "No GitHub clones were found in your home folder, up to 6 folders deep.",
    );
  });
});
