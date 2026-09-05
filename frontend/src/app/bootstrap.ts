import type { StoreApi } from "zustand";
import { api, onStateChanged } from "@/lib/wails";
import type { AppStore } from "@/store/app-store";

// Subscribing before asking for the state means an event emitted in between is
// applied instead of lost.
export async function bootstrap(store: StoreApi<AppStore>): Promise<() => void> {
  const unsubscribe = onStateChanged((state) => store.getState().applyState(state));
  store.getState().applyState(await api.getState());
  return unsubscribe;
}
