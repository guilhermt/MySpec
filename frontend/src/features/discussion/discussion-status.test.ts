import { describe, expect, it } from "vitest";
import {
  decidedCount,
  dependencyLabel,
  discussionRowLabel,
  discussionStatusLabel,
  discussionStatusTone,
  draftsSummary,
  epicGroups,
  kindLabel,
  looseDrafts,
  outcomeLabel,
  refKey,
  refValue,
  repositoryOf,
  waitsLabel,
} from "@/features/discussion/discussion-status";
import { makeDiscussion, makeDraft, makeDraftRef, makeSituation } from "@/test/wails-mock";

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
    expect(discussionStatusLabel(makeDiscussion({ status: "published" }))).toBe("Drafts published");
  });
});

describe("discussionStatusTone", () => {
  it("works while it publishes and rests when it is done", () => {
    expect(discussionStatusTone(makeDiscussion({ status: "publishing" }))).toBe("working");
    expect(discussionStatusTone(makeDiscussion({ status: "published" }))).toBe("done");
    expect(discussionStatusTone(makeDiscussion({ status: "deciding" }))).toBe("idle");
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

describe("dependencyLabel and waitsLabel", () => {
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

  it("says what holds a draft back", () => {
    expect(waitsLabel(makeDraft({ waits: "The epic" }))).toBe("Waits for The epic");
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
