import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap } from "@/app/bootstrap";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { emitState, makeState, subscriberCount } from "@/test/wails-mock";

beforeEach(() => {
  resetAppStore();
});

describe("bootstrap", () => {
  it("subscribes before asking for the state", async () => {
    let subscribersWhenAsked = -1;
    vi.mocked(api.getState).mockImplementationOnce(() => {
      subscribersWhenAsked = subscriberCount();
      return Promise.resolve(makeState());
    });

    await bootstrap(useAppStore);

    expect(subscribersWhenAsked).toBe(1);
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

    emitState(makeState({ workspace: null }));

    expect(useAppStore.getState().app?.workspace).not.toBeNull();
  });
});
