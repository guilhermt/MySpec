import { describe, expect, it } from "vitest";
import {
  dependencyLabel,
  epicDiscardedDetail,
  epicGroups,
  epicRepositoryOf,
  epicWayOut,
  holdLabel,
  holdStands,
  kindLabel,
  looseDrafts,
  outcomeLabel,
  readyToArchiveDetail,
  refKey,
  refValue,
  standingDetail,
  standingEpic,
} from "@/features/discussion/discussion-status";
import type { Draft } from "@/lib/wails";
import { makeDraft, makeDraftRef } from "@/test/wails-mock";

function held(reason: string, hold: Partial<Draft["hold"]> = {}): Draft {
  return makeDraft({
    decision: "approved",
    hold: { reason, title: "", left: 0, approved: 0, cards: 0, ...hold },
  });
}

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

  it("says in how many rounds when there is more than one", () => {
    expect(readyToArchiveDetail(7, 3)).toBe(
      "7 published in 3 rounds · or ask the agent for more cards below",
    );
    expect(readyToArchiveDetail(0, 3)).toBe(
      "nothing published · or ask the agent for more cards below",
    );
  });
});

describe("standingDetail", () => {
  const heldCard = (id: string, epic: string) =>
    makeDraft({
      id,
      decision: "approved",
      epic: makeDraftRef({ draft: epic }),
      hold: { reason: "epic_discarded", title: "", left: 0, approved: 0, cards: 0 },
    });

  it("tells how far the epic that can't publish is", () => {
    const epic = makeDraft({
      id: "epic-1",
      kind: "epic",
      decision: "approved",
      hold: { reason: "epic_short", title: "", left: 0, approved: 1, cards: 3 },
    });

    expect(standingDetail("epic_cant_publish", [makeDraft({ id: "card" }), epic])).toBe(
      "1 of 3 cards approved · approve one more, or discard the epic",
    );
  });

  it("tells the approved cards of the discarded epic", () => {
    const drafts = [
      makeDraft({ id: "epic-1", kind: "epic", decision: "discarded" }),
      heldCard("card-1", "epic-1"),
      heldCard("card-2", "epic-1"),
    ];

    expect(standingDetail("epic_discarded", drafts)).toBe(
      "2 approved cards of it won't publish · approve the epic again, or discard them",
    );
  });

  it("names the discarded epic that holds an approved card, as Show does", () => {
    const quiet = makeDraft({ id: "epic-1", kind: "epic", decision: "discarded" });
    const holding = makeDraft({ id: "epic-2", kind: "epic", decision: "discarded" });
    const drafts = [quiet, holding, heldCard("card-1", "epic-2")];

    expect(standingEpic("epic_discarded", drafts)).toBe(holding);
    expect(standingDetail("epic_discarded", drafts)).toBe(
      "1 approved card of it won't publish · approve the epic again, or discard it",
    );
  });

  it("is null when no draft given explains it", () => {
    expect(standingDetail("epic_cant_publish", [])).toBeNull();
    expect(standingDetail("epic_discarded", [])).toBeNull();
    expect(
      standingDetail("epic_discarded", [
        makeDraft({ id: "epic-1", kind: "epic", decision: "discarded" }),
      ]),
    ).toBeNull();
  });
});

describe("epicRepositoryOf", () => {
  const draft = (repository: string, repositoryId: string): Draft =>
    makeDraft({ repository, repositoryId });

  it("is the repository most of the drafts are in", () => {
    expect(
      epicRepositoryOf([
        draft("acme/api", "r-api"),
        draft("acme/web", "r-web"),
        draft("acme/web", "r-web"),
      ]),
    ).toBe("r-web");
  });

  it("goes to the first by owner/name on a tie", () => {
    expect(epicRepositoryOf([draft("acme/web", "r-web"), draft("acme/api", "r-api")])).toBe(
      "r-api",
    );
  });

  it("ignores drafts without a repository and is empty when none has one", () => {
    expect(epicRepositoryOf([draft("", ""), draft("acme/web", "r-web")])).toBe("r-web");
    expect(epicRepositoryOf([draft("", ""), draft("", "")])).toBe("");
    expect(epicRepositoryOf([])).toBe("");
  });
});
