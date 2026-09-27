import { describe, expect, it } from "vitest";
import { messageOf, noticeDetail } from "@/lib/errors";

describe("messageOf", () => {
  it("is the message of an error", () => {
    expect(messageOf(new Error("the clone is missing"))).toBe("the clone is missing");
  });

  it("prints what is not an error", () => {
    expect(messageOf("gone")).toBe("gone");
  });
});

describe("noticeDetail", () => {
  it.each([
    ["the session is gone", "Try again.", "the session is gone. Try again."],
    ["the session is gone.", "Try again.", "the session is gone. Try again."],
    [
      "gh: not logged in",
      "Check that gh is signed in.",
      "gh: not logged in. Check that gh is signed in.",
    ],
    ["no editor", null, "no editor"],
    ["", "Try again.", "Try again."],
  ] as const)("says %j with %j as %j", (message, remedy, want) => {
    expect(noticeDetail(message, remedy)).toBe(want);
  });
});
