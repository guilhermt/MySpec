import { describe, expect, it } from "vitest";
import {
  decidedCount,
  dependencyLabel,
  discussionDotTone,
  discussionRowLabel,
  discussionStatusLabel,
  discussionStatusTone,
  draftsSummary,
  epicDiscardedDetail,
  epicGroups,
  epicWayOut,
  holdLabel,
  holdStands,
  kindLabel,
  looseDrafts,
  outcomeLabel,
  readyToArchiveDetail,
  refKey,
  refValue,
  repositoryOf,
  standingDetail,
} from "@/features/discussion/discussion-status";
import type { Draft, Situation } from "@/lib/wails";
import { makeDiscussion, makeDraft, makeDraftRef, makeSituation } from "@/test/wails-mock";

const DISCUSSION_PLACE = { kind: "discussion", stage: "", step: 0 };

function discussionSituation(kind: string, group = "waiting"): Situation {
  return makeSituation({ taskId: "discussion-1", kind, group, place: DISCUSSION_PLACE });
}

function held(reason: string, hold: Partial<Draft["hold"]> = {}): Draft {
  return makeDraft({
    decision: "approved",
    hold: { reason, title: "", left: 0, approved: 0, cards: 0, ...hold },
  });
}

describe("discussionStatusLabel", () => {
  it("says where the discussion stands", () => {
    expect(discussionStatusLabel(makeDiscussion())).toBe("Discussing");
    expect(discussionStatusLabel(makeDiscussion({ status: "awaiting_drafts" }))).toBe(
      "Waiting for the drafts",
    );
    expect(discussionStatusLabel(makeDiscussion({ status: "deciding" }))).toBe("Decide drafts");
    expect(discussionStatusLabel(makeDiscussion({ status: "publishing" }))).toBe("Publishing");
    expect(discussionStatusLabel(makeDiscussion({ status: "publish_failed" }))).toBe(
      "Publish failed",
    );
  });

  it.each([
    ["epic_cant_publish", "Epic can't publish"],
    ["epic_discarded", "Epic discarded"],
    ["ready_to_archive", "Ready to archive"],
  ])("names %s", (status, label) => {
    expect(discussionStatusLabel(makeDiscussion({ status }))).toBe(label);
  });
});

describe("discussionStatusTone", () => {
  it("works while it publishes and rests when it is done", () => {
    expect(discussionStatusTone(makeDiscussion({ status: "publishing" }))).toBe("working");
    expect(discussionStatusTone(makeDiscussion({ status: "ready_to_archive" }))).toBe("done");
    expect(discussionStatusTone(makeDiscussion({ status: "deciding" }))).toBe("idle");
  });

  it.each([
    ["ready_to_archive", "done"],
    ["epic_cant_publish", "idle"],
    ["epic_discarded", "idle"],
  ])("tones %s as %s", (status, tone) => {
    expect(discussionStatusTone(makeDiscussion({ status }))).toBe(tone);
  });
});

describe("discussionRowLabel", () => {
  it("reads what waits for the user over what the discussion is doing", () => {
    const situations = [
      makeSituation({
        taskId: "discussion-1",
        kind: "drafts",
        form: "decide",
        place: { kind: "discussion", stage: "", step: 0 },
      }),
    ];

    expect(discussionRowLabel(makeDiscussion({ status: "deciding", situations }))).toBe(
      "Decide drafts",
    );
    expect(discussionRowLabel(makeDiscussion({ status: "discussing" }))).toBe("Discussing");
  });
});

describe("decidedCount and draftsSummary", () => {
  it("counts the drafts the user decided and the ones already published", () => {
    const drafts = [
      makeDraft({ id: "a", decision: "approved" }),
      makeDraft({ id: "b", decision: "" }),
      makeDraft({ id: "c", decision: "", published: true }),
    ];

    expect(decidedCount(drafts)).toBe(2);
    expect(draftsSummary(drafts)).toBe("2 of 3 decided");
  });
});

describe("kindLabel and outcomeLabel", () => {
  it("names what a draft does and what became of it", () => {
    expect(kindLabel(makeDraft({ kind: "new" }))).toBe("New card");
    expect(kindLabel(makeDraft({ kind: "update" }))).toBe("Update");
    expect(kindLabel(makeDraft({ kind: "epic" }))).toBe("Epic");

    expect(outcomeLabel(makeDraft({ outcome: "created" }))).toBe("Created");
    expect(outcomeLabel(makeDraft({ outcome: "updated" }))).toBe("Updated");
    expect(outcomeLabel(makeDraft({ outcome: "" }))).toBe("Not published");
  });
});

describe("epicGroups and looseDrafts", () => {
  const epic = makeDraft({ id: "epic-1", position: 1, kind: "epic" });
  const member = makeDraft({
    id: "draft-2",
    position: 2,
    epic: makeDraftRef({ draft: "epic-1", title: "The epic" }),
  });
  const loose = makeDraft({ id: "draft-3", position: 3 });
  const onIssue = makeDraft({
    id: "draft-4",
    position: 4,
    epic: makeDraftRef({ draft: "", key: "dev/web#9", reference: "dev/web#9" }),
  });
  const drafts = [epic, member, loose, onIssue];

  it("gathers the cards of an epic under it", () => {
    expect(epicGroups(drafts)).toEqual([{ epic, members: [member] }]);
  });

  it("leaves loose what belongs to no epic of the discussion", () => {
    expect(looseDrafts(drafts)).toEqual([loose, onIssue]);
  });
});

describe("refKey and refValue", () => {
  it("reads two spellings of the same issue as one, and hands the Go side the reference", () => {
    const written = makeDraftRef({ draft: "", key: "dev/web#9", reference: "Dev/Web#9" });
    const read = makeDraftRef({ draft: "", key: "dev/web#9", reference: "dev/web#9" });

    expect(refKey(written)).toBe(refKey(read));
    expect(refValue(written)).toBe("Dev/Web#9");
  });

  it("names a draft apart from an issue of the same words", () => {
    expect(refKey(makeDraftRef({ draft: "draft-2" }))).toBe("draft:draft-2");
    expect(refValue(makeDraftRef({ draft: "draft-2" }))).toBe("draft-2");
  });
});

describe("dependencyLabel", () => {
  it("names a draft by its title and an issue by its reference", () => {
    expect(
      dependencyLabel({
        draft: "draft-2",
        key: "",
        reference: "",
        title: "Group the invoices",
        url: "",
        linked: false,
        dropped: "",
        detail: "",
      }),
    ).toBe("Group the invoices");

    expect(
      dependencyLabel({
        draft: "",
        key: "dev/web#9",
        reference: "dev/web#9",
        title: "Export",
        url: "https://github.com/dev/web/issues/9",
        linked: true,
        dropped: "",
        detail: "",
      }),
    ).toBe("dev/web#9 · Export");
  });
});

describe("repositoryOf", () => {
  it("finds the repository a draft is created in", () => {
    const discussion = makeDiscussion();

    expect(repositoryOf(makeDraft(), discussion)?.fullName).toBe("dev/web");
    expect(repositoryOf(makeDraft({ repositoryId: "" }), discussion)).toBeNull();
    expect(repositoryOf(makeDraft({ repositoryId: "repo-9" }), discussion)).toBeNull();
  });
});

describe("discussionDotTone", () => {
  it("reads a closing situation as done", () => {
    const situations = [discussionSituation("ready_to_archive", "closing")];

    expect(discussionDotTone(makeDiscussion({ status: "ready_to_archive", situations }))).toBe(
      "done",
    );
  });

  it("takes the colour of what waits for the user", () => {
    const situations = [discussionSituation("epic_cant_publish")];

    expect(discussionDotTone(makeDiscussion({ status: "epic_cant_publish", situations }))).toBe(
      "attention",
    );
  });

  it("shows what the discussion is doing without a situation", () => {
    expect(discussionDotTone(makeDiscussion({ status: "publishing" }))).toBe("working");
    expect(discussionDotTone(makeDiscussion({ status: "deciding" }))).toBe("idle");
  });
});

describe("holdLabel", () => {
  it.each<[string, Draft, string | null]>([
    ["a discarded epic", held("epic_discarded"), "The epic is discarded · this card won't publish"],
    [
      "one card to decide",
      held("cards", { left: 1 }),
      "Approved · waits for 1 more card of the epic to be decided",
    ],
    [
      "two cards to decide",
      held("cards", { left: 2 }),
      "Approved · waits for 2 more cards of the epic to be decided",
    ],
    [
      "an epic short of approved cards",
      held("epic_short", { approved: 1, cards: 3 }),
      "Approved · the epic needs two approved cards · 1 of 3",
    ],
    ["an epic without cards", held("epic_short"), "Approved · the epic has no cards"],
    ["an epic that does not go", held("epic"), "Approved · waits for the epic"],
    [
      "a draft that does not go",
      held("draft", { title: "Export the invoices" }),
      "Approved · waits for Export the invoices",
    ],
    ["nothing", held(""), null],
  ])("says %s", (_case, draft, expected) => {
    expect(holdLabel(draft)).toBe(expected);
  });
});

describe("holdStands", () => {
  it.each([
    ["epic_short", true],
    ["epic_discarded", true],
    ["cards", false],
    ["epic", false],
    ["draft", false],
    ["", false],
  ])("says %s is %s", (reason, expected) => {
    expect(holdStands(held(reason))).toBe(expected);
  });
});

describe("epicWayOut", () => {
  it.each([
    [1, 3, "1 of 3 cards approved · approve one more, or discard the epic"],
    [0, 3, "0 of 3 cards approved · approve two more, or discard the epic"],
    [1, 1, "1 of 1 card approved · move another card into it, or discard the epic"],
    [0, 1, "0 of 1 card approved · move another card into it, or discard the epic"],
    [0, 0, "No cards · move two cards into it, or discard the epic"],
  ])("tells %i of %i", (approved, cards, expected) => {
    expect(epicWayOut(approved, cards)).toBe(expected);
  });
});

describe("epicDiscardedDetail", () => {
  it("counts the approved cards that won't publish", () => {
    expect(epicDiscardedDetail(1)).toBe(
      "1 approved card of it won't publish · approve the epic again, or discard it",
    );
    expect(epicDiscardedDetail(2)).toBe(
      "2 approved cards of it won't publish · approve the epic again, or discard them",
    );
  });
});

describe("readyToArchiveDetail", () => {
  it("counts what was published", () => {
    expect(readyToArchiveDetail(0)).toBe(
      "nothing published · or ask the agent for more cards below",
    );
    expect(readyToArchiveDetail(5)).toBe("5 published · or ask the agent for more cards below");
  });
});

describe("standingDetail", () => {
  it("tells how far the epic that can't publish is", () => {
    const epic = makeDraft({
      id: "epic-1",
      kind: "epic",
      decision: "approved",
      hold: { reason: "epic_short", title: "", left: 0, approved: 1, cards: 3 },
    });
    const discussion = makeDiscussion({
      drafts: [makeDraft({ id: "card" }), epic],
      situations: [discussionSituation("epic_cant_publish")],
    });

    expect(standingDetail(discussion)).toBe(
      "1 of 3 cards approved · approve one more, or discard the epic",
    );
  });

  it("tells the approved cards of the discarded epic", () => {
    const drafts = [
      makeDraft({ id: "epic-1", kind: "epic", decision: "discarded" }),
      makeDraft({
        id: "card-1",
        decision: "approved",
        epic: makeDraftRef({ draft: "epic-1" }),
        hold: { reason: "epic_discarded", title: "", left: 0, approved: 0, cards: 0 },
      }),
      makeDraft({
        id: "card-2",
        decision: "approved",
        epic: makeDraftRef({ draft: "epic-1" }),
        hold: { reason: "epic_discarded", title: "", left: 0, approved: 0, cards: 0 },
      }),
    ];
    const discussion = makeDiscussion({
      drafts,
      situations: [discussionSituation("epic_discarded")],
    });

    expect(standingDetail(discussion)).toBe(
      "2 approved cards of it won't publish · approve the epic again, or discard them",
    );
  });

  it("tells what a discussion ready to archive published", () => {
    const discussion = makeDiscussion({
      drafts: [makeDraft({ published: true }), makeDraft({ id: "two", published: true })],
      situations: [discussionSituation("ready_to_archive", "closing")],
    });

    expect(standingDetail(discussion)).toBe("2 published · or ask the agent for more cards below");
  });

  it("is null without a situation, for another one, and when the draft that explains it is gone", () => {
    expect(standingDetail(makeDiscussion())).toBeNull();
    expect(
      standingDetail(makeDiscussion({ situations: [discussionSituation("drafts")] })),
    ).toBeNull();
    expect(
      standingDetail(makeDiscussion({ situations: [discussionSituation("epic_cant_publish")] })),
    ).toBeNull();
    expect(
      standingDetail(makeDiscussion({ situations: [discussionSituation("epic_discarded")] })),
    ).toBeNull();
  });
});
