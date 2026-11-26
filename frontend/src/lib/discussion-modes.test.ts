import { describe, expect, it } from "vitest";
import { DISCUSSION_MODES, discussionModeHint, discussionModeLabel } from "@/lib/discussion-modes";
import type { DiscussionMode } from "@/lib/wails";

describe("DISCUSSION_MODES", () => {
  it("offers Refine first", () => {
    expect(DISCUSSION_MODES).toEqual(["refine", "register"]);
  });
});

describe("discussionModeLabel", () => {
  it.each([
    ["refine", "Refine"],
    ["register", "Register"],
  ] as const)("names the %s mode", (mode: DiscussionMode, expected) => {
    expect(discussionModeLabel(mode)).toBe(expected);
  });
});

describe("discussionModeHint", () => {
  it.each([
    ["refine", "The agent asks until the demand is clear and writes structured cards."],
    [
      "register",
      "The agent writes the card from what you wrote and the cards, asking only what it must.",
    ],
  ] as const)("says what the %s mode does to a discussion", (mode: DiscussionMode, expected) => {
    expect(discussionModeHint(mode)).toBe(expected);
  });
});
