import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscussionMenu } from "@/features/discussion/DiscussionMenu";
import type { DiscussionSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeDiscussion, makeDraft, makeState } from "@/test/wails-mock";

function menu(overrides: Partial<DiscussionSummary> = {}) {
  const discussion = makeDiscussion(overrides);
  return renderWithStore(<DiscussionMenu discussion={discussion} />, {
    state: makeState({ boards: [makeBoard()], discussions: [discussion] }),
    ui: { location: { kind: "discussion", id: discussion.id } },
  });
}

async function openMenu(user: ReturnType<typeof menu>["user"]) {
  await user.click(screen.getByRole("button", { name: "More actions" }));
  return screen.findByRole("menu");
}

describe("DiscussionMenu", () => {
  it("groups the discussion, the deletion last after a separator", async () => {
    const { user } = menu();

    const opened = await openMenu(user);

    const groups = within(opened).getAllByRole("group");
    expect(groups.map((group) => group.textContent)).toEqual([
      expect.stringMatching(/^DiscussionOpen RoadmapGroup drafts into an epic…[\s\S]*Archive…/),
      "Delete discussion…",
    ]);
    expect(within(opened).getByRole("separator")).toBeInTheDocument();
  });

  it("dashes Group drafts into an epic with fewer than two loose drafts", async () => {
    const { user } = menu({ drafts: [makeDraft()], round: 1 });
    await openMenu(user);

    const item = screen.getByRole("menuitem", { name: /^Group drafts into an epic…/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("needs two loose drafts not published");
  });

  it("opens the dialog to group through the store", async () => {
    const { user } = menu({
      drafts: [makeDraft({ id: "draft-1" }), makeDraft({ id: "draft-2", position: 1 })],
      round: 1,
    });
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Group drafts into an epic…" }));

    expect(useAppStore.getState().discussionDialog).toEqual({
      discussionId: "discussion-1",
      kind: "group",
    });
  });

  it("opens the board", async () => {
    const { user } = menu();
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Open Roadmap" }));

    expect(useAppStore.getState().location).toEqual({ kind: "board", id: "board-1" });
  });

  it("leaves the board out of a discussion whose board left", async () => {
    const { user } = menu({ boardId: "board-9" });
    await openMenu(user);

    expect(screen.queryByRole("menuitem", { name: /^Open / })).not.toBeInTheDocument();
  });

  it("opens the dialog to archive and the one to delete through the store", async () => {
    const { user } = menu();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Archive…" }));
    expect(useAppStore.getState().discussionDialog).toEqual({
      discussionId: "discussion-1",
      kind: "archive",
    });

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete discussion…" }));
    expect(useAppStore.getState().discussionDialog).toEqual({
      discussionId: "discussion-1",
      kind: "delete",
    });
  });

  it("says why Archive can't, after a ·", async () => {
    const { user } = menu({
      canArchive: false,
      archiveHint: "Approved drafts wait to be published.",
    });
    await openMenu(user);

    const item = screen.getByRole("menuitem", { name: /^Archive…/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("approved drafts wait to be published");
  });

  it("dashes the deletion with a publication running", async () => {
    const { user } = menu({ publishing: true });
    await openMenu(user);

    const item = screen.getByRole("menuitem", { name: /^Delete discussion…/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("a publication is running");
  });
});
