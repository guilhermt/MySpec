import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "@/app/bootstrap";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import {
  emitState,
  emitTranscript,
  makeEntry,
  makeState,
  makeTranscript,
  subscriberCount,
  transcriptSubscriberCount,
} from "@/test/wails-mock";

beforeEach(() => {
  resetAppStore();
});

describe("bootstrap", () => {
  it("subscribes before asking for the state", async () => {
    let subscribersWhenAsked = -1;
    let transcriptSubscribersWhenAsked = -1;
    vi.mocked(api.getState).mockImplementationOnce(() => {
      subscribersWhenAsked = subscriberCount();
      transcriptSubscribersWhenAsked = transcriptSubscriberCount();
      return Promise.resolve(makeState());
    });

    await bootstrap(useAppStore);

    expect(subscribersWhenAsked).toBe(1);
    expect(transcriptSubscribersWhenAsked).toBe(1);
  });

  it("applies the first snapshot to the store", async () => {
    vi.mocked(api.getState).mockResolvedValueOnce(makeState({ theme: "dark" }));

    await bootstrap(useAppStore);

    expect(useAppStore.getState().app?.theme).toBe("dark");
  });

  it("applies a later state:changed event", async () => {
    await bootstrap(useAppStore);

    emitState(makeState({ workspace: null }));

    expect(useAppStore.getState().app?.workspace).toBeNull();
  });

  it("stops applying events once unsubscribed", async () => {
    const unsubscribe = await bootstrap(useAppStore);
    unsubscribe();

    expect(subscriberCount()).toBe(0);
    expect(transcriptSubscriberCount()).toBe(0);

    emitState(makeState({ workspace: null }));

    expect(useAppStore.getState().app?.workspace).not.toBeNull();
  });

  it("applies a transcript:changed event to the conversation it belongs to", async () => {
    await bootstrap(useAppStore);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: "task-1" }));
    const entry = makeEntry("user", { id: "a", seq: 1 });

    emitTranscript({ taskId: "task-1", kind: "entry", entry, entryId: "", text: "" });

    expect(useAppStore.getState().transcripts["task-1"]?.entries).toEqual([entry]);
  });

  it("reads the conversation again when it is reset", async () => {
    await bootstrap(useAppStore);
    useAppStore.getState().setTranscript(makeTranscript({ taskId: "task-1" }));

    emitTranscript({ taskId: "task-1", kind: "reset", entry: null, entryId: "", text: "" });
    await vi.waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("task-1");
    });

    expect(useAppStore.getState().transcripts["task-1"]?.status).toBe("ready");
  });

  it("leaves a reset alone when the conversation was never loaded", async () => {
    await bootstrap(useAppStore);

    emitTranscript({ taskId: "task-1", kind: "reset", entry: null, entryId: "", text: "" });

    expect(api.getTranscript).not.toHaveBeenCalled();
    expect(useAppStore.getState().transcripts["task-1"]).toBeUndefined();
  });
});
