import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DraftsCard } from "@/features/discussion/DraftsCard";
import { api, type DiscussionSummary, type Draft } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeDraft, makeDraftRef, makeState } from "@/test/wails-mock";

// The round: an epic with two cards, then a loose card.
function round(overrides: Record<string, Partial<Draft>> = {}): Draft[] {
  const epic = makeDraftRef({ draft: "epic-1", title: "Pricing tiers" });
  const drafts = [
    makeDraft({ id: "epic-1", kind: "epic", position: 0, title: "Pricing tiers" }),
    makeDraft({ id: "a", position: 1, title: "Alpha", epic }),
    makeDraft({ id: "b", position: 2, title: "Beta", epic }),
    makeDraft({ id: "c", position: 3, title: "Gamma" }),
  ];
  return drafts.map((draft) => ({ ...draft, ...overrides[draft.id] }));
}

function draw(
  drafts: Draft[],
  discussion: Partial<DiscussionSummary> = {},
  target: { draft: string; retry: boolean } | null = null,
  ui: Parameters<typeof renderWithStore>[1] extends infer O ? O : never = {},
) {
  const summary = makeDiscussion({ drafts, round: 1, status: "deciding", ...discussion });
  const view = renderWithStore(<DraftsCard discussion={summary} target={target} />, {
    state: makeState({ discussions: [summary] }),
    ...ui,
  });
  const again = (next: Draft[], more: Partial<DiscussionSummary> = {}) =>
    view.rerender(
      <DraftsCard discussion={{ ...summary, drafts: next, ...more }} target={target} />,
    );
  return { ...view, summary, again };
}

const item = (id: string) => document.querySelector<HTMLElement>(`[data-card-item="${id}"]`);
const open = (id: string) => item(id)?.getAttribute("aria-expanded") === "true";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DraftsCard", () => {
  it("lists the epic with its cards under it, then the loose ones, numbered in that order", () => {
    draw(round());

    const card = screen.getByRole("group", { name: "Drafts of round 1" });
    expect(within(card).getByRole("heading")).toHaveTextContent("Round 1 · drafts4");
    expect(
      [...card.querySelectorAll("[data-card-item]")].map((each) =>
        each.getAttribute("data-card-item"),
      ),
    ).toEqual(["epic-1", "a", "b", "c"]);
    const group = within(card).getByRole("group", { name: "Epic Pricing tiers and its 2 cards" });
    expect(group.querySelectorAll("[data-card-item]")).toHaveLength(3);
    expect(item("b")).toHaveAccessibleName(/^Draft 3 of 4: New card\. Beta\./);
    expect(item("c")).toHaveAccessibleName(/^Draft 4 of 4: New card\. Gamma\./);
  });

  it("opens the first draft to decide, and folds the others", () => {
    draw(round({ "epic-1": { decision: "approved" } }));

    expect(open("a")).toBe(true);
    expect(open("epic-1")).toBe(false);
    expect(open("b")).toBe(false);
    expect(open("c")).toBe(false);
  });

  it("opens none when nothing is left to decide, with the first holding the tab stop", () => {
    draw(
      round({
        "epic-1": { decision: "discarded" },
        a: { decision: "approved" },
        b: { decision: "approved" },
        c: { decision: "discarded" },
      }),
    );

    for (const id of ["epic-1", "a", "b", "c"]) {
      expect(open(id)).toBe(false);
    }
    expect(item("epic-1")).toHaveAttribute("tabindex", "0");
  });

  it("opens the draft the request names", () => {
    draw(round(), {}, { draft: "c", retry: false });

    expect(open("c")).toBe(true);
    expect(open("epic-1")).toBe(false);
    expect(item("c")).toHaveAttribute("data-request-target");
  });

  it("opens a folded draft with a click, with Enter and with the arrows", async () => {
    const { user } = draw(round());

    await user.click(item("c") as HTMLElement);
    expect(open("c")).toBe(true);
    expect(item("c")).toHaveFocus();

    fireEvent.keyDown(item("b") as HTMLElement, { key: "Enter" });
    expect(open("b")).toBe(true);
    expect(item("b")).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(open("a")).toBe(true);
    expect(item("a")).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(open("c")).toBe(true);
    expect(item("c")).toHaveFocus();
  });

  it("keeps the focus on a draft whose approval publishes", async () => {
    const { user } = draw(round({ a: { approvePublishes: ["a"] } }));
    item("a")?.focus();

    await user.keyboard("a");

    expect(api.decideDraft).toHaveBeenCalledExactlyOnceWith("discussion-1", "a", "approved");
    expect(open("a")).toBe(true);
    expect(item("a")).toHaveFocus();
  });

  it("moves to the next draft to decide when the decision publishes nothing", async () => {
    const { user } = draw(round());
    item("a")?.focus();

    await user.keyboard("d");

    expect(api.decideDraft).toHaveBeenCalledExactlyOnceWith("discussion-1", "a", "discarded");
    expect(item("b")).toHaveFocus();
    expect(open("b")).toBe(true);
  });

  it("goes round to the first draft to decide, and stays with none left", async () => {
    const { user } = draw(
      round({
        "epic-1": { decision: "approved" },
        a: { decision: "approved" },
        b: { decision: "approved" },
      }),
    );
    item("c")?.focus();

    await user.keyboard("a");

    expect(item("c")).toHaveFocus();
  });

  it("leaves A, D and the clicks inert for 900 ms after a decision", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const { user } = draw(round());
    item("a")?.focus();

    await user.keyboard("a");
    await user.keyboard("d");
    now.mockReturnValue(1_800);
    await user.click(screen.getByRole("button", { name: /^Discard/ }));
    expect(api.decideDraft).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_950);
    item("b")?.focus();
    await user.keyboard("d");

    expect(api.decideDraft).toHaveBeenCalledTimes(2);
    expect(api.decideDraft).toHaveBeenLastCalledWith("discussion-1", "b", "discarded");
  });

  it("does not lock after an A the title refuses, so a D right away discards", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const { user } = draw(round({ c: { title: "" } }));
    item("c")?.focus();

    await user.keyboard("a");
    expect(api.decideDraft).not.toHaveBeenCalled();
    now.mockReturnValue(1_100);
    await user.keyboard("d");

    expect(api.decideDraft).toHaveBeenCalledExactlyOnceWith("discussion-1", "c", "discarded");
  });

  it("decides with the click of Approve through the same advance", async () => {
    const { user } = draw(round());

    await user.click(screen.getByRole("button", { name: /^Approve/ }));

    expect(api.decideDraft).toHaveBeenCalledExactlyOnceWith("discussion-1", "epic-1", "approved");
  });

  it("undoes a decision with the same key and keeps the focus", async () => {
    const { user } = draw(
      round({ a: { decision: "approved" }, "epic-1": { decision: "approved" } }),
    );
    item("b")?.focus();
    await user.keyboard("{ArrowUp}");
    expect(item("a")).toHaveFocus();

    await user.keyboard("a");

    expect(api.decideDraft).toHaveBeenCalledExactlyOnceWith("discussion-1", "a", "");
    expect(item("a")).toHaveFocus();
  });

  it("edits the open draft with E and closes the edit with Esc, giving the focus back", async () => {
    const { user } = draw(round());
    item("a")?.focus();

    await user.keyboard("e");

    const title = await screen.findByRole("textbox", { name: "Title" });
    expect(title).toHaveFocus();
    expect(title).toHaveValue("Alpha");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    await waitFor(() => expect(item("a")).toHaveFocus());
  });

  it("closes the edit with Done", async () => {
    const { user } = draw(round());
    await user.click(screen.getByRole("button", { name: /^Edit/ }));

    await user.click(await screen.findByRole("button", { name: "Done" }));

    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    await waitFor(() => expect(item("epic-1")).toHaveFocus());
  });

  it("does not edit with E typed into a field", async () => {
    const { user } = draw(round());
    item("epic-1")?.focus();
    await user.keyboard("e");
    const title = await screen.findByRole("textbox", { name: "Title" });

    await user.type(title, "e");

    expect(title).toHaveValue("Pricing tierse");
  });

  it("closes the edit when the agent revises the draft", async () => {
    const drafts = round();
    const { user, again } = draw(drafts);
    item("a")?.focus();
    await user.keyboard("e");
    await screen.findByRole("textbox", { name: "Title" });

    again(
      drafts.map((draft) =>
        draft.id === "a" ? { ...draft, revision: 2, title: "Alpha 2" } : draft,
      ),
    );

    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
  });

  it("closes the edit when another draft becomes the current one, with the focus where it went", async () => {
    const { user } = draw(round());
    item("a")?.focus();
    await user.keyboard("e");
    await screen.findByRole("textbox", { name: "Title" });

    await user.click(item("c") as HTMLElement);

    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    expect(item("c")).toHaveFocus();

    await user.keyboard("{ArrowUp}{ArrowUp}");

    expect(open("a")).toBe(true);
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    expect(item("a")).toHaveFocus();
  });

  it("keeps the edit open for a revision that doesn't change the draft", async () => {
    const drafts = round();
    const { user, again } = draw(drafts);
    item("a")?.focus();
    await user.keyboard("e");
    await screen.findByRole("textbox", { name: "Title" });

    again(drafts.map((draft) => (draft.id === "b" ? { ...draft, title: "Beta 2" } : draft)));

    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
  });

  it("disables the decision and the edit with the reason during a publication", async () => {
    const { user } = draw(round(), { publishing: true });
    // Nothing is left to decide on its own while the race runs: the user opens one.
    await user.click(item("epic-1") as HTMLElement);

    const approve = screen.getByRole("button", { name: /^Approve/ });
    expect(approve).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /^Discard/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getAllByText("A publication is running · the decision waits for it").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Edit/ })).toHaveAttribute("aria-disabled", "true");
    item("epic-1")?.focus();

    await user.keyboard("a");

    expect(api.decideDraft).not.toHaveBeenCalled();
  });

  it("gives the focus back to the card when the focused draft leaves", () => {
    const drafts = round();
    const { again } = draw(drafts);
    act(() => item("c")?.focus());
    expect(item("c")).toHaveFocus();

    again(drafts.filter((draft) => draft.id !== "c"));

    expect(item("c")).toBeNull();
    expect(document.activeElement?.closest("[data-decision-card]")).not.toBeNull();
  });

  it("opens and focuses the draft a grouping asked for, and clears the request", async () => {
    draw(round(), {}, null, {
      ui: { draftRequest: { discussionId: "discussion-1", draftId: "c" } },
    });

    await waitFor(() => expect(item("c")).toHaveFocus());
    expect(open("c")).toBe(true);
    expect(useAppStore.getState().draftRequest).toBeNull();
  });

  it("waits for the draft of the request to be in the card", async () => {
    const drafts = round();
    const { again } = draw(drafts.slice(0, 3), {}, null, {
      ui: { draftRequest: { discussionId: "discussion-1", draftId: "c" } },
    });
    expect(useAppStore.getState().draftRequest).not.toBeNull();

    again(drafts);

    await waitFor(() => expect(item("c")).toHaveFocus());
    expect(useAppStore.getState().draftRequest).toBeNull();
  });
});
