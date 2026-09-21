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

  it("publishes the epic once everything under it is decided", async () => {
    const { user } = group({ canPublish: true });

    await user.click(screen.getByRole("button", { name: "Publish epic" }));

    expect(api.publishEpic).toHaveBeenCalledWith("discussion-1", "epic-1");
  });

  it("says why the epic can't be published yet", () => {
    group({ canPublish: false, hint: "Decide every card of the epic first." });

    expect(screen.getByRole("button", { name: "Publish epic" })).toBeDisabled();
    expect(screen.getByText("Decide every card of the epic first.")).toBeInTheDocument();
  });

  it("holds Publish epic while the run of the epic is under way", () => {
    group({ canPublish: true, publishing: true });

    expect(screen.getByRole("button", { name: "Publish epic" })).toBeDisabled();
  });

  it("shows the refusal of a publication where the button is", async () => {
    vi.mocked(api.publishEpic).mockRejectedValueOnce(new Error("the epic has a dependency cycle"));
    const { user } = group({ canPublish: true });

    await user.click(screen.getByRole("button", { name: "Publish epic" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("the epic has a dependency cycle");
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

  it("marks an epic the user discarded", () => {
    group({ decision: "discarded" });

    expect(screen.getByRole("region", { name: "Epic Invoices" })).toHaveTextContent("Discarded");
  });
});
