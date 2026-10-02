import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EpicGroup } from "@/features/discussion/EpicGroup";
import type { Draft } from "@/lib/wails";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeDraft, makeDraftRef, makeState } from "@/test/wails-mock";

const MEMBER = makeDraft({
  id: "draft-2",
  position: 2,
  title: "Group the invoices",
  epic: makeDraftRef({ draft: "epic-1", title: "Invoices" }),
});

function group(epicOverrides: Partial<Draft> = {}, members: Draft[] = [MEMBER]) {
  const epic = makeDraft({
    id: "epic-1",
    position: 1,
    kind: "epic",
    title: "Invoices",
    ...epicOverrides,
  });
  const discussion = makeDiscussion({ drafts: [epic, ...members], status: "deciding" });
  return renderWithStore(<EpicGroup discussion={discussion} group={{ epic, members }} />, {
    state: makeState({ discussions: [discussion] }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EpicGroup", () => {
  it("holds the epic and the cards under it", () => {
    group();

    const section = screen.getByRole("region", { name: "Epic Invoices" });
    const cards = within(section).getAllByRole("article");
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Draft Invoices",
      "Draft Group the invoices",
    ]);
  });

  it("has no Publish epic button", () => {
    group({ decision: "approved" });

    expect(screen.queryByRole("button", { name: "Publish epic" })).toBeNull();
  });

  it("links the issue of an epic that was published", () => {
    group({
      outcome: "created",
      number: 30,
      url: "https://github.com/dev/web/issues/30",
      published: true,
      publishedAt: "2026-09-17T12:00:00Z",
    });

    expect(screen.queryByRole("button", { name: "Publish epic" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "dev/web#30" }).length).toBeGreaterThan(0);
  });

  it("offers the run again when a step after the issue of the epic failed", async () => {
    const { user } = group({
      outcome: "created",
      number: 30,
      url: "https://github.com/dev/web/issues/30",
      publishError: "Couldn't write to GitHub: gh: the board said no",
    });

    const section = screen.getByRole("region", { name: "Epic Invoices" });
    expect(section).toHaveTextContent("Couldn't write to GitHub: gh: the board said no");
    expect(within(section).getAllByRole("button", { name: "Retry" })).toHaveLength(1);
    await user.click(within(section).getByRole("button", { name: "Retry" }));

    expect(api.retryPublish).toHaveBeenCalledWith("discussion-1", "epic-1");
  });

  it("dims an epic the user discarded", () => {
    group({ decision: "discarded" });

    expect(screen.getByRole("region", { name: "Epic Invoices" })).toHaveClass("opacity-60");
  });
});
