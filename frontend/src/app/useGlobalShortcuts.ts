import { useEffect } from "react";
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
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
