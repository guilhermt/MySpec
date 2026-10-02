import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bootstrap } from "@/app/bootstrap";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { DiscussionView } from "@/features/discussion/DiscussionView";
import { api, type DiscussionSummary } from "@/lib/wails";
import { useAppStore, useLocation } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  emitSituationOpen,
  makeDiscussion,
  makeDraft,
  makeEntry,
  makeSituation,
  makeState,
  makeTranscript,
} from "@/test/wails-mock";

function view(overrides: Partial<DiscussionSummary> = {}) {
  return renderWithStore(<DiscussionView discussionId="discussion-1" />, {
    state: makeState({ discussions: [makeDiscussion(overrides)] }),
    ui: { location: { kind: "discussion", id: "discussion-1" } },
  });
}

describe("DiscussionView", () => {
  it("puts the header and the conversation together", async () => {
    view();

    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByText("Discussing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Documents" })).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("discussion-1", "discussion");
    });
  });

  it("puts the drafts of the round in a card of the conversation", async () => {
    view({ status: "deciding", round: 1, drafts: [makeDraft()] });

    expect(await screen.findByRole("group", { name: "Drafts of round 1" })).toHaveTextContent(
      "Round 1 · drafts",
    );
    expect(
      screen.getByRole("group", { name: /^Draft 1 of 1: New card\. Export the invoices\./ }),
    ).toBeInTheDocument();
  });

  it("goes to the next draft to decide with Alt+↓ and to the previous with Alt+↑", async () => {
    const { user } = view({
      status: "deciding",
      round: 1,
      drafts: [
        makeDraft({ id: "draft-1", title: "One", position: 0, decision: "approved" }),
        makeDraft({ id: "draft-2", title: "Two", position: 1 }),
        makeDraft({ id: "draft-3", title: "Three", position: 2 }),
      ],
    });
    const item = (id: string) => document.querySelector<HTMLElement>(`[data-card-item="${id}"]`);
    await screen.findByRole("group", { name: "Drafts of round 1" });
    await user.click(screen.getByRole("textbox"));

    // The current draft is the first to decide, so the next one is the one after it.
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(item("draft-3")).toHaveFocus();

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(item("draft-2")).toHaveFocus();

    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(item("draft-3")).toHaveFocus();
  });

  it("leaves Alt+↓ alone with a dialog open", async () => {
    const { user } = view({
      status: "deciding",
      round: 1,
      drafts: [makeDraft({ id: "draft-1" }), makeDraft({ id: "draft-2", position: 1 })],
    });
    await screen.findByRole("group", { name: "Drafts of round 1" });
    await user.click(screen.getByRole("textbox"));
    act(() => useAppStore.getState().openDiscussionDialog("discussion-1", "archive"));
    await screen.findByRole("alertdialog");

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");

    expect(document.querySelector("[data-card-item]:focus")).toBeNull();
  });

  it("opens the documents panel from its button, and closes it with ×", async () => {
    const { user } = view();
    const button = () => screen.getByRole("button", { name: "Documents" });
    expect(screen.queryByRole("complementary", { name: "Documents" })).not.toBeInTheDocument();

    await user.click(button());
    expect(button()).toHaveAttribute("aria-pressed", "true");
    const panel = screen.getByRole("complementary", { name: "Documents" });
    expect(panel).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "Documents" })).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  it("opens Details and Documents one at a time", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByRole("complementary", { name: "Details" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Documents" }));
    expect(screen.queryByRole("complementary", { name: "Details" })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Documents" })).toBeInTheDocument();
  });

  it("opens the dialog the store asks for, and closes it when the screen goes away", async () => {
    const { unmount } = view();

    act(() => useAppStore.getState().openDiscussionDialog("discussion-1", "archive"));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Archive “Invoices”?");

    unmount();

    expect(useAppStore.getState().discussionDialog).toBeNull();
  });

  it("archives from the menu of its header", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Archive…" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Archive “Invoices”?");
  });

  it("shows nothing at all for a discussion that is no longer there", () => {
    const { container } = renderWithStore(<DiscussionView discussionId="discussion-9" />, {
      state: makeState({ discussions: [makeDiscussion()] }),
    });

    expect(container.querySelector("header")).toBeNull();
  });

  it("lets nothing but the conversation scroll in its column", () => {
    view();

    const column = screen.getByRole("textbox").closest(".overflow-clip");
    expect(column).not.toBeNull();
  });

  it("reads the conversation as a feed of the discussion agent", async () => {
    vi.mocked(api.getTranscript).mockResolvedValueOnce(
      makeTranscript({
        taskId: "discussion-1",
        stage: "discussion",
        entries: [makeEntry("user"), makeEntry("assistant")],
      }),
    );
    view();

    const feed = await screen.findByRole("feed", {
      name: "Conversation with the discussion agent",
    });
    expect(within(feed).getByRole("article", { name: /^You, / })).toBeInTheDocument();
    expect(within(feed).getByRole("article", { name: /^Discussion agent, / })).toHaveTextContent(
      "On it.",
    );
  });
});

const PLACE = { kind: "discussion", stage: "discussion", step: 0 };
const DRAFTS = makeSituation({
  id: "s-drafts",
  taskId: "discussion-1",
  kind: "drafts",
  group: "waiting",
  place: PLACE,
});

// Shell is the discussion screen where the app draws it, with the shortcuts of the app.
function Shell() {
  useGlobalShortcuts();
  const location = useLocation();
  return location.kind === "discussion" ? <DiscussionView discussionId={location.id} /> : null;
}

describe("DiscussionView, arriving from elsewhere", () => {
  const deciding = () =>
    makeState({
      discussions: [
        makeDiscussion({
          status: "deciding",
          round: 1,
          sessionStatus: "waiting",
          turnRunning: false,
          processRunning: false,
          situations: [DRAFTS],
          drafts: [
            makeDraft({ id: "draft-1", title: "One", decision: "approved" }),
            makeDraft({ id: "draft-2", title: "Two", position: 1 }),
          ],
        }),
      ],
    });
  const target = () => document.querySelector<HTMLElement>('[data-card-item="draft-2"]');

  it("takes the focus to the draft to decide on Ctrl+J", async () => {
    const { user } = renderWithStore(<Shell />, { state: deciding() });

    await user.keyboard("{Control>}j{/Control}");

    expect(useAppStore.getState().location).toEqual({ kind: "discussion", id: "discussion-1" });
    await waitFor(() => expect(target()).toHaveFocus());
  });

  it("takes the focus to the draft to decide from the notification", async () => {
    renderWithStore(<Shell />, { state: deciding() });

    act(() => useAppStore.getState().openSituation("discussion-1", DRAFTS.place));

    await waitFor(() => expect(target()).toHaveFocus());
  });

  it("takes the focus to the draft to decide when the notification event arrives", async () => {
    vi.mocked(api.getState).mockResolvedValue(deciding());
    renderWithStore(<Shell />, { state: deciding() });
    await bootstrap(useAppStore);

    act(() => emitSituationOpen({ taskId: "discussion-1", place: DRAFTS.place }));

    await waitFor(() => expect(target()).toHaveFocus());
  });
});

describe("DiscussionView, arriving at the other situations", () => {
  const at = (kind: string, discussion: Partial<DiscussionSummary>) =>
    makeState({
      discussions: [
        makeDiscussion({
          round: 1,
          sessionStatus: "waiting",
          turnRunning: false,
          processRunning: false,
          situations: [
            makeSituation({ id: `s-${kind}`, taskId: "discussion-1", kind, place: PLACE }),
          ],
          ...discussion,
        }),
      ],
    });

  it("takes the focus to the Retry of the draft where the publication stopped", async () => {
    renderWithStore(<Shell />, {
      state: at("publish_failed", {
        status: "publish_failed",
        drafts: [
          makeDraft({ id: "draft-1", title: "One", decision: "approved", publishError: "No." }),
          makeDraft({ id: "draft-2", title: "Two", position: 1, decision: "approved" }),
        ],
      }),
    });

    act(() => useAppStore.getState().openSituation("discussion-1", PLACE));

    const retry = await screen.findByRole("button", { name: "Retry" });
    await waitFor(() => expect(retry).toHaveFocus());
  });

  it("takes the focus to the primary of the bar when the discussion is ready to archive", async () => {
    renderWithStore(<Shell />, {
      state: at("ready_to_archive", {
        status: "ready_to_archive",
        drafts: [makeDraft({ outcome: "created" })],
      }),
    });

    act(() => useAppStore.getState().openSituation("discussion-1", PLACE));

    await waitFor(() => expect(screen.getByRole("button", { name: "Archive…" })).toHaveFocus());
  });
});

describe("DiscussionView, a situation born with the screen open", () => {
  it("blinks the bar and announces it", async () => {
    const before = makeDiscussion({ status: "discussing", round: 0 });
    view({ status: "discussing", round: 0 });
    expect(screen.queryByRole("region", { name: "Request" })).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().applyState(
        makeState({
          discussions: [
            {
              ...before,
              status: "deciding",
              round: 1,
              sessionStatus: "waiting",
              turnRunning: false,
              situations: [DRAFTS],
              drafts: [makeDraft()],
            },
          ],
        }),
      );
      useAppStore.getState().flashSituation(DRAFTS.id);
    });

    const bar = screen.getByRole("region", { name: "Request" });
    expect(bar).toHaveAttribute("data-flash", "wait");
    expect(within(bar).getByRole("status")).toHaveTextContent("Decide drafts");
    expect(useAppStore.getState().announcement?.text).toBe(
      "Invoices: waiting for you: decide drafts in round 1",
    );
  });
});
