import type { StoreApi } from "zustand";
import { FLASH_MS } from "@/lib/situations";
import {
  api,
  onSituationOpen,
  onSituationStarted,
  onStateChanged,
  onTranscriptChanged,
  sessionKey,
} from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import type { AppStore } from "@/store/app-store";

// Subscribing before asking for the state means an event emitted in between is
// applied instead of lost.
export async function bootstrap(store: StoreApi<AppStore>): Promise<() => void> {
  const stopTranscript = onTranscriptChanged((event) => {
    store.getState().applyTranscriptEvent(event);
    // A reset says the conversation changed wholesale; only a conversation
    // the interface already loaded is worth loading again.
    const key = sessionKey(event.taskId, event.stage);
    if (event.kind === "reset" && store.getState().transcripts[key] !== undefined) {
      void loadTranscript(event.taskId, event.stage);
    }
  });
  const stopState = onStateChanged((state) => store.getState().applyState(state));
  const stopStarted = onSituationStarted((event) => {
    // With the window away, the notification is what tells the user.
    if (!event.focused) {
      return;
    }
    const id = event.situation.id;
    store.getState().flashSituation(id);
    setTimeout(() => store.getState().unflashSituation(id), FLASH_MS);
  });
  const stopOpen = onSituationOpen((event) =>
    store.getState().openSituation(event.taskId, event.place),
  );
  store.getState().applyState(await api.getState());
  return () => {
    stopState();
    stopTranscript();
    stopStarted();
    stopOpen();
  };
}
