import { useEffect } from "react";
import { waitingEntries } from "@/lib/situations";
import { type AppStore, useAppStore } from "@/store/app-store";

// The shortcuts belong to the product itself: the welcome screen and the
// refused migration answer to none of them.
function productOnScreen(store: AppStore): boolean {
  return (
    store.app !== null &&
    store.app.migration === null &&
    ((store.app.repositories ?? []).length > 0 || (store.app.boards ?? []).length > 0)
  );
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !(event.ctrlKey || event.metaKey)) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case "n": {
          const store = useAppStore.getState();
          if (!productOnScreen(store)) {
            return;
          }
          event.preventDefault();
          store.openNewTask();
          break;
        }
        case "j": {
          const store = useAppStore.getState();
          if (!productOnScreen(store)) {
            return;
          }
          event.preventDefault();
          // The creation dialog holds what the user is typing; it is not left behind.
          if (store.newTaskOpen) {
            return;
          }
          const [first] = waitingEntries(store.app, store.openTaskId);
          if (first !== undefined) {
            store.openPlace(first.task.id, first.situation.place);
          }
          break;
        }
        case ",": {
          const store = useAppStore.getState();
          if (!productOnScreen(store)) {
            return;
          }
          event.preventDefault();
          // The creation dialog holds what the user is typing; it is not left behind.
          if (store.newTaskOpen) {
            return;
          }
          if (store.settingsOpen) {
            store.closeSettings();
          } else {
            store.openSettings();
          }
          break;
        }
        default:
          break;
      }
    };

    // On the window, a shortcut works wherever the focus is, the message box of
    // a conversation included.
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
