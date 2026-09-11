import { useEffect } from "react";
import { waitingEntries } from "@/lib/situations";
import { openFolderDialog } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !(event.ctrlKey || event.metaKey)) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case "o":
          event.preventDefault();
          void openFolderDialog();
          break;
        case "n": {
          const store = useAppStore.getState();
          // The welcome screen has no node to create a task for.
          if ((store.app?.workspace ?? null) === null) {
            return;
          }
          event.preventDefault();
          store.openNewTask(store.selectedNodeId);
          break;
        }
        case "j": {
          const store = useAppStore.getState();
          if ((store.app?.workspace ?? null) === null) {
            return;
          }
          event.preventDefault();
          // The creation dialog holds what the user is typing; it is not left behind.
          if (store.newTaskFor !== null) {
            return;
          }
          const [first] = waitingEntries(store.app, store.openTaskId);
          if (first !== undefined) {
            store.openPlace(first.task.id, first.situation.place);
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
