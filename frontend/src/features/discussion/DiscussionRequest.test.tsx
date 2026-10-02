import { act, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscussionRequest } from "@/features/discussion/DiscussionRequest";
import { api, type DiscussionSummary, type Draft, type Situation } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeDiscussion,
  makeDraft,
  makeDraftRef,
  makeEntry,
  makeSituation,
  makeState,
} from "@/test/wails-mock";

const PLACE = { kind: "discussion", stage: "discussion", step: 0 };

function situation(kind: string, group = "waiting", form = ""): Situation {
  return makeSituation({
    id: `s-${kind}`,
    taskId: "discussion-1",
    kind,
    group,
    form,
    place: PLACE,
  });
}

// atRest is a discussion in round 1, waiting on the situation given.
function atRest(overrides: Partial<DiscussionSummary> = {}): DiscussionSummary {
  return makeDiscussion({
    title: "Usage-based pricing tiers",
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    round: 1,
    ...overrides,
  });
}

function bar(overrides: Partial<DiscussionSummary> = {}, ui = {}) {
  const discussion = atRest(overrides);
  return renderWithStore(<DiscussionRequest discussion={discussion} />, {
    state: makeState({ discussions: [discussion] }),
    ui,
  });
}

const request = () => screen.getByRole("region", { name: "Request" });

// A draft is a div the bar's Show focuses, like the card draws it.
function drawCard(drafts: Draft[], retry = false) {
  const card = document.createElement("div");
  card.setAttribute("data-decision-card", "");
  for (const draft of drafts) {
    const item = document.createElement("div");
    item.tabIndex = 0;
    item.dataset.cardItem = draft.id;
    item.scrollIntoView = vi.fn();
    const button = document.createElement("button");
    button.dataset.retry = "";
    item.append(button);
    if (retry) {
      button.setAttribute("data-request-target", "");
    } else if (draft === drafts[0]) {
      item.setAttribute("data-request-target", "");
    }
    card.append(item);
  }
  document.body.append(card);
  return card;
}

describe("DiscussionRequest", () => {
  it("asks to decide the drafts, with how many are decided", () => {
    bar({
      status: "deciding",
      situations: [situation("drafts")],
      drafts: [
        makeDraft({ id: "d1", decision: "approved" }),
        makeDraft({ id: "d2", position: 1 }),
        makeDraft({ id: "d3", position: 2 }),
      ],
    });

    expect(request()).toHaveTextContent("Decide drafts");
    expect(request()).toHaveTextContent("round 1");
    expect(request()).toHaveTextContent("1 of 3 decided");
    expect(screen.getByRole("button", { name: "Next to decide" })).toBeEnabled();
  });

  it("says nothing when the discussion asks nothing", () => {
    bar({ status: "discussing", round: 0, sessionStatus: "working", turnRunning: true });

    expect(screen.queryByRole("region", { name: "Request" })).not.toBeInTheDocument();
  });

  it("takes the focus to the next draft to decide", async () => {
    const drafts = [
      makeDraft({ id: "d1", decision: "approved" }),
      makeDraft({ id: "d2", position: 1 }),
    ];
    const { user } = bar({ status: "deciding", situations: [situation("drafts")], drafts });
    const card = drawCard(drafts);

    await user.click(screen.getByRole("button", { name: "Next to decide" }));

    expect(card.querySelector('[data-card-item="d2"]')).toHaveFocus();
    card.remove();
  });

  it("shows the draft where the publication stopped, and goes on to its Retry", async () => {
    const drafts = [makeDraft({ id: "d1", decision: "approved", publishError: "GitHub said no." })];
    const { user } = bar({
      status: "publish_failed",
      situations: [situation("publish_failed", "error")],
      drafts,
    });
    const card = drawCard(drafts, true);

    expect(request()).toHaveTextContent("Publish failed");
    await user.click(screen.getByRole("button", { name: "Show" }));

    await vi.waitFor(() => expect(card.querySelector("[data-retry]")).toHaveFocus());
    card.remove();
  });

  it("shows the epic that can't be published", async () => {
    const epic = makeDraft({
      id: "e1",
      kind: "epic",
      decision: "approved",
      approveHold: { reason: "epic_short" } as Draft["approveHold"],
    });
    const { user } = bar({
      status: "epic_cant_publish",
      situations: [situation("epic_cant_publish")],
      drafts: [epic, makeDraft({ id: "d2", position: 1, epic: makeDraftRef({ draft: "e1" }) })],
    });
    const card = drawCard([epic]);

    await user.click(screen.getByRole("button", { name: "Show" }));

    expect(card.querySelector('[data-card-item="e1"]')).toHaveFocus();
    card.remove();
  });

  it("shows the discarded epic whose approved cards won't publish", async () => {
    const epic = makeDraft({ id: "e1", kind: "epic", decision: "discarded" });
    const card = makeDraft({
      id: "d2",
      position: 1,
      decision: "approved",
      epic: makeDraftRef({ draft: "e1" }),
      hold: { reason: "epic_discarded" } as Draft["hold"],
    });
    const { user } = bar({
      status: "epic_discarded",
      situations: [situation("epic_discarded")],
      drafts: [epic, card],
    });
    const group = drawCard([epic, card]);

    await user.click(screen.getByRole("button", { name: "Show" }));

    expect(group.querySelector('[data-card-item="e1"]')).toHaveFocus();
    group.remove();
  });

  it.each(["question", "permission"])(
    "shows the %s card of the conversation, with no draft to go to",
    async (kind) => {
      const { user } = bar(
        { situations: [situation(kind)] },
        {
          transcripts: {
            "discussion-1|discussion": {
              status: "ready",
              error: "",
              entries: [makeEntry(kind === "question" ? "question" : "permission")],
              pending: [],
              buffered: [],
            },
          },
        },
      );
      const card = document.createElement("div");
      card.setAttribute("data-pending-card", kind);
      const target = document.createElement("button");
      target.setAttribute(
        kind === "question" ? "role" : "data-default-focus",
        kind === "question" ? "radio" : "",
      );
      target.setAttribute("aria-checked", "false");
      target.tabIndex = 0;
      const group = document.createElement("div");
      group.setAttribute("data-question", "0");
      group.append(target);
      card.append(kind === "question" ? group : target);
      document.body.append(card);

      await user.click(screen.getByRole("button", { name: "Show" }));

      expect(target).toHaveFocus();
      card.remove();
    },
  );

  it("restarts the agent after its session stopped", async () => {
    const { user } = bar({
      lastError: "It crashed.",
      sessionStatus: "stopped",
      situations: [situation("session_error", "error")],
    });

    await user.click(screen.getByRole("button", { name: "Retry discussion agent" }));

    expect(api.retry).toHaveBeenCalledWith("discussion-1", "discussion");
  });

  it("says Retrying… while the session restarts", async () => {
    vi.mocked(api.retry).mockReturnValueOnce(new Promise(() => {}));
    const { user } = bar({
      lastError: "It crashed.",
      sessionStatus: "stopped",
      situations: [situation("session_error", "error")],
    });

    await user.click(screen.getByRole("button", { name: "Retry discussion agent" }));

    expect(await screen.findByRole("button", { name: "Retrying…" })).toBeInTheDocument();
  });

  it("opens the archive dialog when the discussion is ready to be archived", async () => {
    const { user } = bar({
      status: "ready_to_archive",
      situations: [situation("ready_to_archive", "waiting")],
      drafts: [makeDraft({ outcome: "created" })],
    });

    await user.click(screen.getByRole("button", { name: "Archive…" }));

    expect(useAppStore.getState().discussionDialog).toEqual({
      discussionId: "discussion-1",
      kind: "archive",
    });
  });

  it("is quiet while the discussion is paused", () => {
    bar({
      status: "deciding",
      sessionStatus: "paused",
      situations: [situation("drafts")],
      drafts: [makeDraft()],
    });

    expect(request()).toHaveAttribute("data-form", "quiet");
  });

  it("blinks while the situation is flashing", () => {
    bar(
      { status: "deciding", situations: [situation("drafts")], drafts: [makeDraft()] },
      { flashing: new Set(["s-drafts"]) },
    );

    expect(request()).toHaveAttribute("data-flash", "wait");
  });

  describe("a situation born with the screen open", () => {
    const asked = () =>
      atRest({ status: "deciding", situations: [situation("drafts")], drafts: [makeDraft()] });

    it("says it in the status of the bar and to the live region, once", () => {
      const before = atRest({ status: "discussing", round: 0 });
      const { rerender } = renderWithStore(<DiscussionRequest discussion={before} />, {
        state: makeState({ discussions: [before] }),
      });
      expect(useAppStore.getState().announcement).toBeNull();

      act(() => rerender(<DiscussionRequest discussion={asked()} />));

      expect(within(request()).getByRole("status")).toHaveTextContent("Decide drafts");
      expect(useAppStore.getState().announcement?.text).toBe(
        "Usage-based pricing tiers: waiting for you: decide drafts in round 1",
      );
      const id = useAppStore.getState().announcement?.id;

      act(() => rerender(<DiscussionRequest discussion={{ ...asked(), title: "Another" }} />));
      expect(useAppStore.getState().announcement?.id).toBe(id);
    });

    it("stays silent for the situation that was there when the screen opened", () => {
      bar({ status: "deciding", situations: [situation("drafts")], drafts: [makeDraft()] });

      expect(within(request()).getByRole("status")).toBeEmptyDOMElement();
      expect(useAppStore.getState().announcement).toBeNull();
    });
  });
});
