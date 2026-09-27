import { useEffect } from "react";
import { layerOpen, modalOpen } from "@/lib/layers";
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

// runShortcut runs what a Ctrl or Cmd shortcut does.
function runShortcut(key: string, store: AppStore): void {
  switch (key) {
    case "n":
      store.openNewTask();
      break;
    case "j": {
      const [first] = waitingEntries(store.app, openItemId(store.location));
      if (first !== undefined) {
        store.openSituation(first.itemId, first.situation.place);
      }
      break;
    }
    case ",":
      if (store.location.kind === "settings") {
        store.closeSettings();
      } else {
        store.openSettings();
      }
      break;
    default:
      break;
  }
}

function isShortcut(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey) {
    return ["n", "j", ","].includes(event.key.toLowerCase());
  }
  // Alt+← and Alt+→ step through the history of places.
  return event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight");
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const store = useAppStore.getState();
      if (event.repeat || !isShortcut(event) || !productOnScreen(store)) {
        return;
      }
      event.preventDefault();
      // A modal dialog holds what the user is doing there: a shortcut neither
      // leaves it behind nor stacks another over it.
      if (modalOpen()) {
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        runShortcut(event.key.toLowerCase(), store);
      } else if (event.key === "ArrowLeft") {
        store.goBack({ focus: "title" });
      } else {
        store.goForward({ focus: "title" });
      }
    };

    // Esc closes what the place on screen has open, once nothing closer to the
    // user took it: the owners of Esc inside the screen (the message box, the
    // search of a board, a draft) prevent its default, and a layer over the
    // screen closes first.
    const onEscape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        layerOpen()
      ) {
        return;
      }
      const store = useAppStore.getState();
      if (store.promptEdit !== null) {
        store.cancelPromptEdit();
      } else if (store.location.kind === "settings") {
        store.closeSettings();
      } else {
        return;
      }
      event.preventDefault();
    };

    // On the window, a shortcut works wherever the focus is, the message box of
    // a conversation included; Esc listens in the bubble phase, after the
    // owners inside the screen.
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);
}
