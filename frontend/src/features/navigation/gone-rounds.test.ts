import { describe, expect, it } from "vitest";
import {
  DELETED_DISCUSSION_TEXT,
  goneDiscussionText,
  goneRoundLines,
} from "@/features/navigation/gone-rounds";
import { clockTime, shortTime } from "@/lib/when";
import { makeArchivedDiscussion, makeDraft } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-30T18:00:00Z");
const LATE = "2026-09-30T15:12:00Z";
const EARLY = "2026-09-30T14:30:00Z";

describe("goneDiscussionText", () => {
  it("says when the conversation ended and where the rest is", () => {
    const archived = makeArchivedDiscussion({ archivedAt: LATE });

    expect(goneDiscussionText(archived, NOW)).toBe(
      `The conversation ended at ${clockTime(LATE, NOW)}. The document, the drafts and what was published are in History; a task started from one of these cards gets the document in its context.`,
    );
  });

  it("leaves the time out when it wasn't kept", () => {
    expect(goneDiscussionText(makeArchivedDiscussion({ archivedAt: "" }), NOW)).toMatch(
      /^The conversation ended\. The document/,
    );
  });
});

describe("goneRoundLines", () => {
  it("writes a line per round with what it published and when it last did", () => {
    const archived = makeArchivedDiscussion({
      drafts: [
        makeDraft({ id: "a", round: 1, published: true, outcome: "created", publishedAt: EARLY }),
        makeDraft({ id: "b", round: 1, published: true, outcome: "created", publishedAt: LATE }),
        makeDraft({ id: "c", round: 1, published: true, outcome: "updated", publishedAt: EARLY }),
        makeDraft({ id: "d", round: 2, decision: "discarded" }),
      ],
    });

    expect(goneRoundLines(archived, NOW)).toEqual([
      { text: "Round 1 · 2 created, 1 updated", time: shortTime(LATE, NOW) },
      { text: "Round 2 · nothing published", time: "" },
    ]);
  });

  it("has no line without drafts", () => {
    expect(goneRoundLines(makeArchivedDiscussion({ drafts: [] }), NOW)).toEqual([]);
  });
});

describe("DELETED_DISCUSSION_TEXT", () => {
  it("says what stays on GitHub", () => {
    expect(DELETED_DISCUSSION_TEXT).toBe(
      "The conversation, the document and the drafts are gone. What was published on GitHub stays.",
    );
  });
});
