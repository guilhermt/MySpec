import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap, connect } from "@/app/bootstrap";
import { announcement, FLASH_MS } from "@/lib/situations";
import { api, onSituationOpen, onSituationStarted, type Place } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import {
  emitSituationOpen,
  emitSituationStarted,
  emitStartup,
  emitState,
  emitTranscript,
  makeDiscussion,
  makeEntry,
  makePullRequest,
  makeReviewSummary,
  makeSituation,
  makeStartup,
  makeStartupFailure,
  makeStartupStep,
  makeState,
  makeTask,
  makeTranscript,
  subscriberCount,
  transcriptSubscriberCount,
} from "@/test/wails-mock";

beforeEach(() => {
  resetAppStore();
});

afterEach(() => {
  vi.useRealTimers();
});

const PR_PLACE: Place = { kind: "pr", stage: "", step: 0 };
const REVIEW_PLACE: Place = { kind: "review", stage: "", step: 0 };

// A task in the PR stage, writing its draft.
function inPR() {
  return makeState({
    tasks: [makeTask({ stage: "pr", pr: makePullRequest({ status: "drafting" }) })],
  });
}

describe("connect", () => {
  it("subscribes before asking for the state", async () => {
    let subscribersWhenAsked = -1;
    let transcriptSubscribersWhenAsked = -1;
    let situationSubscriptionsWhenAsked = -1;
    vi.mocked(api.getState).mockImplementationOnce(() => {
      subscribersWhenAsked = subscriberCount();
      transcriptSubscribersWhenAsked = transcriptSubscriberCount();
      situationSubscriptionsWhenAsked =
        vi.mocked(onSituationStarted).mock.calls.length +
        vi.mocked(onSituationOpen).mock.calls.length;
      return Promise.resolve(makeState());
    });

    await connect(useAppStore);

    expect(subscribersWhenAsked).toBe(1);
    expect(transcriptSubscribersWhenAsked).toBe(1);
    expect(situationSubscriptionsWhenAsked).toBe(2);
  });

  it("applies the first snapshot to the store", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(makeState({ theme: "dark" }));

    await connect(useAppStore);

    expect(useAppStore.getState().app?.theme).toBe("dark");
  });

  it("applies a later state:changed event", async () => {
    await connect(useAppStore);

    emitState(makeState({ repositoryFilter: "repo-1" }));

    expect(useAppStore.getState().app?.repositoryFilter).toBe("repo-1");
  });

  it("stops applying events once unsubscribed", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(inPR());
    const unsubscribe = await connect(useAppStore);
    unsubscribe();

    expect(subscriberCount()).toBe(0);
    expect(transcriptSubscriberCount()).toBe(0);

    emitState(makeState({ repositoryFilter: "repo-1" }));
    emitSituationStarted({ situation: makeSituation({ id: "s1" }), focused: true });
    emitSituationOpen({ taskId: "task-1", place: PR_PLACE });

    expect(useAppStore.getState().app?.repositoryFilter).toBe("");
    expect(useAppStore.getState().flashing.size).toBe(0);
    expect(useAppStore.getState().location).toEqual({ kind: "home" });
  });

  it("applies a transcript:changed event to the conversation it belongs to", async () => {
    await connect(useAppStore);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: "task-1" }));
    const entry = makeEntry("user", { id: "a", seq: 1 });

    emitTranscript({ taskId: "task-1", stage: "prd", kind: "entry", entry, entryId: "", text: "" });

    expect(useAppStore.getState().transcripts["task-1|prd"]?.entries).toEqual([entry]);
  });

  it("reads the conversation again when it is reset", async () => {
    await connect(useAppStore);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: "task-1" }));

    emitTranscript({
      taskId: "task-1",
      stage: "prd",
      kind: "reset",
      entry: null,
      entryId: "",
      text: "",
    });
    await vi.waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1", "prd");
    });

    expect(useAppStore.getState().transcripts["task-1|prd"]?.status).toBe("ready");
  });

  it("leaves a reset alone when the conversation was never loaded", async () => {
    await connect(useAppStore);

    emitTranscript({
      taskId: "task-1",
      stage: "prd",
      kind: "reset",
      entry: null,
      entryId: "",
      text: "",
    });

    expect(api.getTranscript).not.toHaveBeenCalled();
    expect(useAppStore.getState().transcripts["task-1|prd"]).toBeUndefined();
  });

  it("highlights a situation that started under the eyes of the user, for a moment", async () => {
    await connect(useAppStore);
    vi.useFakeTimers();

    emitSituationStarted({ situation: makeSituation({ id: "s1" }), focused: true });
    expect(useAppStore.getState().flashing.has("s1")).toBe(true);

    vi.advanceTimersByTime(FLASH_MS - 1);
    expect(useAppStore.getState().flashing.has("s1")).toBe(true);

    vi.advanceTimersByTime(1);
    expect(useAppStore.getState().flashing.has("s1")).toBe(false);
  });

  it("leaves the highlight to the notification when the window was away", async () => {
    await connect(useAppStore);

    emitSituationStarted({ situation: makeSituation({ id: "s1" }), focused: false });

    expect(useAppStore.getState().flashing.size).toBe(0);
  });

  it("announces a situation that started under the eyes of the user", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(
      makeState({ tasks: [makeTask({ id: "task-1", name: "add-login" })] }),
    );
    await connect(useAppStore);

    emitSituationStarted({ situation: makeSituation({ taskId: "task-1" }), focused: true });

    expect(useAppStore.getState().announcement?.text).toBe(
      announcement("add-login", makeSituation({ taskId: "task-1" })),
    );
  });

  it("announces a situation of a review by its title", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(
      makeState({ reviews: [makeReviewSummary({ id: "review-1", title: "Fix the login" })] }),
    );
    await connect(useAppStore);
    const situation = makeSituation({ taskId: "review-1", place: REVIEW_PLACE });

    emitSituationStarted({ situation, focused: true });

    expect(useAppStore.getState().announcement?.text).toBe(
      announcement("Fix the login", situation),
    );
  });

  it("announces a situation of a discussion by its title, in its round", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(
      makeState({
        discussions: [makeDiscussion({ id: "discussion-1", title: "Invoices", round: 2 })],
      }),
    );
    await connect(useAppStore);
    const situation = makeSituation({
      kind: "drafts",
      taskId: "discussion-1",
      place: { kind: "discussion", stage: "", step: 0 },
    });

    emitSituationStarted({ situation, focused: true });

    expect(useAppStore.getState().announcement?.text).toBe("Invoices: decide drafts in round 2");
  });

  it("announces nothing when the window was away", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(makeState({ tasks: [makeTask()] }));
    await connect(useAppStore);

    emitSituationStarted({ situation: makeSituation({ taskId: "task-1" }), focused: false });

    expect(useAppStore.getState().announcement).toBeNull();
  });

  it("announces nothing for an item the state does not have", async () => {
    await connect(useAppStore);

    emitSituationStarted({ situation: makeSituation({ taskId: "task-gone" }), focused: true });

    expect(useAppStore.getState().announcement).toBeNull();
  });

  it("opens the place of a notification the user clicked", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(inPR());
    await connect(useAppStore);

    emitSituationOpen({ taskId: "task-1", place: PR_PLACE });

    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });
  });

  it("leaves a modal dialog where it is when the user clicks a notification", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(inPR());
    await connect(useAppStore);
    const dialog = document.createElement("div");
    dialog.setAttribute("data-slot", "dialog-content");
    document.body.append(dialog);

    emitSituationOpen({ taskId: "task-1", place: PR_PLACE });

    expect(useAppStore.getState().location).toEqual({ kind: "home" });
    dialog.remove();
  });
});

describe("bootstrap", () => {
  it("waits for the startup to be ready before asking for the state", async () => {
    vi.mocked(api.getStartup).mockResolvedValueOnce(
      makeStartup({ phase: "starting", steps: [makeStartupStep({ state: "running" })] }),
    );

    await bootstrap(useAppStore);
    await Promise.resolve();

    expect(useAppStore.getState().startup?.phase).toBe("starting");
    expect(api.getState).not.toHaveBeenCalled();
    expect(subscriberCount()).toBe(0);
  });

  it("applies the ready that arrives as an event and then asks for the state", async () => {
    vi.mocked(api.getStartup).mockResolvedValueOnce(makeStartup({ phase: "starting" }));
    vi.mocked(api.getState).mockResolvedValueOnce(makeState({ theme: "dark" }));
    await bootstrap(useAppStore);

    emitStartup(makeStartup({ phase: "ready" }));

    await waitFor(() => expect(useAppStore.getState().app?.theme).toBe("dark"));
    expect(useAppStore.getState().startup?.phase).toBe("ready");
  });

  it("keeps a failure on the store without asking for the state", async () => {
    vi.mocked(api.getStartup).mockResolvedValueOnce(makeStartup({ phase: "starting" }));
    await bootstrap(useAppStore);

    emitStartup(makeStartup({ phase: "failed", failure: makeStartupFailure() }));

    expect(useAppStore.getState().startup?.failure?.case).toBe("other");
    expect(api.getState).not.toHaveBeenCalled();
  });

  it("connects once when ready arrives twice", async () => {
    await bootstrap(useAppStore);

    emitStartup(makeStartup({ phase: "ready" }));
    emitStartup(makeStartup({ phase: "ready" }));

    await waitFor(() => expect(useAppStore.getState().app).not.toBeNull());
    expect(api.getState).toHaveBeenCalledTimes(1);
    expect(subscriberCount()).toBe(1);
  });

  it("stops the connection that was still being made when it is disposed", async () => {
    const dispose = await bootstrap(useAppStore);

    dispose();

    await waitFor(() => expect(api.getState).toHaveBeenCalled());
    await waitFor(() => expect(subscriberCount()).toBe(0));
  });
});
