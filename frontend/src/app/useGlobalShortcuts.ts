import { useEffect } from "react";
import { openItemId } from "@/lib/locations";
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

// The dialogs that create a task, start a review and create a discussion hold
// what the user is typing: a shortcut neither leaves them behind nor stacks
// another over them.
function typingInDialog(store: AppStore): boolean {
  return store.newTaskOpen || store.startReview !== null || store.newDiscussion !== null;
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
          if (typingInDialog(store)) {
            return;
          }
          store.openNewTask();
          break;
        }
        case "j": {
          const store = useAppStore.getState();
          if (!productOnScreen(store)) {
            return;
          }
          event.preventDefault();
          if (typingInDialog(store)) {
            return;
          }
          const [first] = waitingEntries(store.app, openItemId(store.location));
          if (first !== undefined) {
            store.openSituation(first.itemId, first.situation.place);
          }
          break;
        }
        case ",": {
          const store = useAppStore.getState();
          if (!productOnScreen(store)) {
            return;
          }
          event.preventDefault();
          if (typingInDialog(store)) {
            return;
          }
          if (store.location.kind === "settings") {
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
