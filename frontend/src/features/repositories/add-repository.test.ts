import { describe, expect, it } from "vitest";
import {
  addLabel,
  filterCandidates,
  NO_CANDIDATES_TEXT,
  SCANNING_TEXT,
} from "@/features/repositories/add-repository";
import { makeRepositoryCandidate } from "@/test/wails-mock";

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

describe("texts", () => {
  it("say what the scan does", () => {
    expect(SCANNING_TEXT).toBe("Scanning your home folder…");
    expect(NO_CANDIDATES_TEXT).toBe(
      "No GitHub clones were found in your home folder, up to 6 folders deep.",
    );
  });
});
