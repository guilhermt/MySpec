import { describe, expect, it } from "vitest";
import { draftTitle, publishedOutcome } from "@/lib/drafts";
import { makeDraft } from "@/test/wails-mock";

describe("draftTitle", () => {
  it.each([
    ["the title", makeDraft({ title: "  Overage  " }), "Overage"],
    ["an untitled card", makeDraft({ title: "" }), "Untitled draft"],
    ["an untitled epic", makeDraft({ title: " ", kind: "epic" }), "Untitled epic"],
  ])("is %s", (_name, one, expected) => {
    expect(draftTitle(one)).toBe(expected);
  });
});

describe("publishedOutcome", () => {
  const created = makeDraft({ published: true, outcome: "created" });
  const updated = makeDraft({ published: true, outcome: "updated" });
  const started = makeDraft({ published: false, outcome: "created" });
  const open = makeDraft({ published: false, outcome: "" });

  it.each([
    [
      "counts what was created and updated",
      [created, created, updated, open],
      "2 created, 1 updated",
    ],
    ["leaves out a count of none", [updated], "1 updated"],
    ["counts only what is published", [created, started], "1 created"],
    ["is empty without a publication", [open, started], ""],
    ["is empty without drafts", [], ""],
  ])("%s", (_name, drafts, expected) => {
    expect(publishedOutcome(drafts)).toBe(expected);
  });
});
