import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "@/app/bootstrap";
import { FLASH_MS } from "@/lib/situations";
import { api, onSituationOpen, onSituationStarted, type Place } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import {
  emitSituationOpen,
  emitSituationStarted,
  emitState,
  emitTranscript,
  makeEntry,
  makePullRequest,
  makeSituation,
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

// A task in the PR stage, writing its draft.
function inPR() {
  return makeState({
    tasks: [makeTask({ stage: "pr", pr: makePullRequest({ status: "drafting" }) })],
  });
}

describe("bootstrap", () => {
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

    await bootstrap(useAppStore);

    expect(subscribersWhenAsked).toBe(1);
    expect(transcriptSubscribersWhenAsked).toBe(1);
    expect(situationSubscriptionsWhenAsked).toBe(2);
  });

  it("applies the first snapshot to the store", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(makeState({ theme: "dark" }));

    await bootstrap(useAppStore);

    expect(useAppStore.getState().app?.theme).toBe("dark");
  });

  it("applies a later state:changed event", async () => {
    await bootstrap(useAppStore);

    emitState(makeState({ repositoryFilter: "repo-1" }));

    expect(useAppStore.getState().app?.repositoryFilter).toBe("repo-1");
  });

  it("stops applying events once unsubscribed", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(inPR());
    const unsubscribe = await bootstrap(useAppStore);
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
    await bootstrap(useAppStore);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: "task-1" }));
    const entry = makeEntry("user", { id: "a", seq: 1 });

    emitTranscript({ taskId: "task-1", stage: "prd", kind: "entry", entry, entryId: "", text: "" });

    expect(useAppStore.getState().transcripts["task-1|prd"]?.entries).toEqual([entry]);
  });

  it("reads the conversation again when it is reset", async () => {
    await bootstrap(useAppStore);
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
    await bootstrap(useAppStore);

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
    await bootstrap(useAppStore);
    vi.useFakeTimers();

    emitSituationStarted({ situation: makeSituation({ id: "s1" }), focused: true });
    expect(useAppStore.getState().flashing.has("s1")).toBe(true);

    vi.advanceTimersByTime(FLASH_MS - 1);
    expect(useAppStore.getState().flashing.has("s1")).toBe(true);

    vi.advanceTimersByTime(1);
    expect(useAppStore.getState().flashing.has("s1")).toBe(false);
  });

  it("leaves the highlight to the notification when the window was away", async () => {
    await bootstrap(useAppStore);

    emitSituationStarted({ situation: makeSituation({ id: "s1" }), focused: false });

    expect(useAppStore.getState().flashing.size).toBe(0);
  });

  it("opens the place of a notification the user clicked", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(inPR());
    await bootstrap(useAppStore);

    emitSituationOpen({ taskId: "task-1", place: PR_PLACE });

    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });
  });

  it("leaves a modal dialog where it is when the user clicks a notification", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(inPR());
    await bootstrap(useAppStore);
    const dialog = document.createElement("div");
    dialog.setAttribute("data-slot", "dialog-content");
    document.body.append(dialog);

    emitSituationOpen({ taskId: "task-1", place: PR_PLACE });

    expect(useAppStore.getState().location).toEqual({ kind: "home" });
    dialog.remove();
  });
});
