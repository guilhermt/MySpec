import { describe, expect, it } from "vitest";
import { availableAnnouncement, availableText, failureReason, newlyAvailable } from "@/lib/update";
import { makeUpdate } from "@/test/wails-mock";

describe("availableText", () => {
  it("says the version is available", () => {
    expect(availableText("0.5.0")).toBe("MySpec 0.5.0 is available");
  });
});

describe("availableAnnouncement", () => {
  it("ends the text with a period", () => {
    expect(availableAnnouncement("0.5.0")).toBe("MySpec 0.5.0 is available.");
  });
});

describe("newlyAvailable", () => {
  it.each([
    ["from none to a version", "", "0.5.0", "0.5.0"],
    ["from a version to a newer one", "0.5.0", "0.6.0", "0.6.0"],
    ["the same version", "0.5.0", "0.5.0", null],
    ["a version that went away", "0.5.0", "", null],
  ])("%s", (_name, before, after, expected) => {
    expect(newlyAvailable(makeUpdate({ latest: before }), makeUpdate({ latest: after }))).toBe(
      expected,
    );
  });

  it("counts a missing previous state as nothing known", () => {
    expect(newlyAvailable(undefined, makeUpdate({ latest: "0.5.0" }))).toBe("0.5.0");
    expect(newlyAvailable(undefined, makeUpdate())).toBeNull();
    expect(newlyAvailable(undefined, undefined)).toBeNull();
  });
});

describe("failureReason", () => {
  it.each([
    ["offline", "x", "No connection to GitHub."],
    ["rate_limited", "x", "GitHub's rate limit was reached. Try again later."],
    ["timeout", "x", "GitHub didn't answer in time."],
    ["failed", "GitHub answered 404 Not Found.", "GitHub answered 404 Not Found."],
    ["failed", "", "Something went wrong."],
    ["surprise", "It broke.", "It broke."],
  ])("%s", (kind, detail, expected) => {
    expect(failureReason({ kind, detail })).toBe(expected);
  });
});
