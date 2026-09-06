import { useEffect } from "react";
import { openFolderDialog } from "@/store/actions";

export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !(event.ctrlKey || event.metaKey)) {
        return;
      }
      if (event.key.toLowerCase() !== "o") {
        return;
      }
      event.preventDefault();
      void openFolderDialog();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
