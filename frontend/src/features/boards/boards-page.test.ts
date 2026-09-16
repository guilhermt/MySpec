import { describe, expect, it } from "vitest";
import { ownerText, readingText, removalText } from "@/features/boards/boards-page";
import { makeBoard } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-16T12:05:00Z");

describe("ownerText", () => {
  it("names the owner and whether it is an organization or a user", () => {
    expect(ownerText(makeBoard())).toBe("dev · Organization");
    expect(ownerText(makeBoard({ owner: "ana", ownerType: "user" }))).toBe("ana · User");
  });
});

describe("readingText", () => {
  it("tells how long ago the board was read, or that it never was", () => {
    expect(readingText(makeBoard(), NOW)).toBe("Updated 5 min ago");
    expect(readingText(makeBoard({ readAt: "" }), NOW)).toBe("Not read yet");
  });

  it("tells the failure of the last reading over its time", () => {
    const board = makeBoard({
      failure: {
        reason: "not_found",
        message: "The board doesn't exist or this account can't read it.",
        failedAt: "2026-09-16T12:04:00Z",
      },
    });

    expect(readingText(board, NOW)).toBe("The board doesn't exist or this account can't read it.");
  });
});

describe("removalText", () => {
  it("counts the repositories that move and the ones that leave, in singular and plural", () => {
    expect(removalText({ toNoBoard: 2, removed: 0 })).toBe(
      "2 repositories move to No board and 0 leave MySpec. Tasks keep their cards, and nothing changes on GitHub or on disk.",
    );
    expect(removalText({ toNoBoard: 1, removed: 1 })).toBe(
      "1 repository moves to No board and 1 leaves MySpec. Tasks keep their cards, and nothing changes on GitHub or on disk.",
    );
  });
});
