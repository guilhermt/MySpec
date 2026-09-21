import { describe, expect, it } from "vitest";
import {
  canStart,
  suggestedTitle,
  TITLE_MAX,
  titleProblem,
  unclonedRepositories,
} from "@/features/discussion/new-discussion";
import { makeBoard, makeBoardCard, makeRepository } from "@/test/wails-mock";

const CARD = makeBoardCard();
const OTHER = makeBoardCard({ key: "dev/web#13", number: 13, title: "Reset the password" });

describe("suggestedTitle", () => {
  it("is the title of the one card picked", () => {
    expect(suggestedTitle([CARD])).toBe("Add the login screen");
  });

  it("is empty with several cards, which have no title of their own", () => {
    expect(suggestedTitle([CARD, OTHER])).toBe("");
  });

  it("is empty without cards", () => {
    expect(suggestedTitle([])).toBe("");
  });
});

describe("titleProblem", () => {
  it("wants a title", () => {
    expect(titleProblem("   ")).toBe("empty");
  });

  it("keeps the title short", () => {
    expect(titleProblem("a".repeat(TITLE_MAX + 1))).toBe("too_long");
  });

  it("takes a title that fits", () => {
    expect(titleProblem("Billing, end to end")).toBeNull();
  });
});

describe("canStart", () => {
  it("wants a title", () => {
    expect(canStart("", "Something to look at", [CARD])).toBe(false);
  });

  it("takes cards without text", () => {
    expect(canStart("Billing", "", [CARD])).toBe(true);
  });

  it("takes text without cards", () => {
    expect(canStart("Billing", "The invoices are late", [])).toBe(true);
  });

  it("wants something to discuss", () => {
    expect(canStart("Billing", "  ", [])).toBe(false);
  });
});

describe("unclonedRepositories", () => {
  it("keeps the repositories of the board without a clone, and those whose clone is gone", () => {
    const board = makeBoard({ repositoryIds: ["repo-1", "repo-2", "repo-3"] });
    const repositories = [
      makeRepository(),
      makeRepository({ id: "repo-2", name: "api", fullName: "dev/api", cloned: false }),
      makeRepository({ id: "repo-3", name: "cli", fullName: "dev/cli", missing: true }),
    ];

    expect(unclonedRepositories(board, repositories).map((one) => one.id)).toEqual([
      "repo-2",
      "repo-3",
    ]);
  });

  it("ignores a repository the board names and the app does not have", () => {
    const board = makeBoard({ repositoryIds: ["gone"] });

    expect(unclonedRepositories(board, [makeRepository()])).toEqual([]);
  });
});
