import type { StoreApi } from "zustand";
import { modalOpen } from "@/lib/layers";
import { announcement, FLASH_MS } from "@/lib/situations";
import {
  api,
  asStartupPhase,
  onSituationOpen,
  onSituationStarted,
  onStartupChanged,
  onStateChanged,
  onTranscriptChanged,
  type Startup,
  sessionKey,
} from "@/lib/wails";
import { loadTranscript, setTheme } from "@/store/actions";
import type { AppStore } from "@/store/app-store";

// itemName is the name of the task, review or discussion with the id, null
// when none is on the state.
function itemName(store: AppStore, id: string): string | null {
  const task = store.app?.tasks?.find((item) => item.id === id);
  const review = store.app?.reviews?.find((item) => item.id === id);
  const discussion = store.app?.discussions?.find((item) => item.id === id);
  return task?.name ?? review?.title ?? discussion?.title ?? null;
}

// discussionRound is the round of the discussion with the id, 0 for an item that is not one.
function discussionRound(store: AppStore, id: string): number {
  return store.app?.discussions?.find((item) => item.id === id)?.round ?? 0;
}

// The window opens before the data: the startup is followed until it is ready,
// and only then are the state and its events asked for.
export async function bootstrap(store: StoreApi<AppStore>): Promise<() => void> {
  let stopConnected: (() => void) | null = null;
  let connecting = false;
  let stopped = false;
  const follow = (startup: Startup) => {
    store.getState().applyStartup(startup);
    if (asStartupPhase(startup.phase) === "ready" && !connecting) {
      connecting = true;
      void connect(store).then((stop) => {
        if (stopped) {
          stop();
          return;
        }
        stopConnected = stop;
      });
    }
  };
  const stopStartup = onStartupChanged(follow);
  follow(await api.getStartup());
  return () => {
    stopped = true;
    stopStartup();
    stopConnected?.();
  };
}

// Subscribing before asking for the state means an event emitted in between is
// applied instead of lost.
export async function connect(store: StoreApi<AppStore>): Promise<() => void> {
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
    const { situation } = event;
    store.getState().flashSituation(situation.id);
    setTimeout(() => store.getState().unflashSituation(situation.id), FLASH_MS);
    const name = itemName(store.getState(), situation.taskId);
    if (name !== null) {
      store
        .getState()
        .announce(
          announcement(name, situation, discussionRound(store.getState(), situation.taskId)),
        );
    }
  });
  // A modal dialog on screen holds what the user is doing there: the click on
  // the notification only brought the window forward.
  const stopOpen = onSituationOpen((event) => {
    if (!modalOpen()) {
      store.getState().openSituation(event.taskId, event.place);
    }
  });
  const state = await api.getState();
  store.getState().applyState(state);
  // The theme chosen at the start goes now that the database answers.
  const chosen = store.getState().startupTheme;
  if (chosen !== null && chosen !== state.theme && state.migration === null) {
    await setTheme(chosen);
    store.getState().clearStartupTheme();
  }
  return () => {
    stopState();
    stopTranscript();
    stopStarted();
    stopOpen();
  };
}
