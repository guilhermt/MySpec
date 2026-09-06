import type { StoreApi } from "zustand";
import { api, onStateChanged, onTranscriptChanged } from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import type { AppStore } from "@/store/app-store";

// Subscribing before asking for the state means an event emitted in between is
// applied instead of lost.
export async function bootstrap(store: StoreApi<AppStore>): Promise<() => void> {
  const stopTranscript = onTranscriptChanged((event) => {
    store.getState().applyTranscriptEvent(event);
    // A reset says the conversation changed wholesale; only a task the
    // interface already loaded is worth loading again.
    if (event.kind === "reset" && store.getState().transcripts[event.taskId] !== undefined) {
      void loadTranscript(event.taskId);
    }
  });
  const stopState = onStateChanged((state) => store.getState().applyState(state));
  store.getState().applyState(await api.getState());
  return () => {
    stopState();
    stopTranscript();
  };
}
