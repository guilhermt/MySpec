import { useEffect } from "react";
import { api } from "@/lib/wails";
import { useOnScreenSituationId } from "@/store/app-store";

/**
 * useViewedSituation tells the app which situation is on screen whenever that
 * changes and whenever the window comes back to the front, so that a
 * notification the user no longer needs goes away.
 */
export function useViewedSituation(): void {
  const id = useOnScreenSituationId();

  useEffect(() => {
    if (id === null) {
      return;
    }
    // A place on screen behind another window is not a place the user reached.
    const view = () => {
      if (document.hasFocus()) {
        // A notification left on screen is no failure worth telling the user about.
        void api.viewSituation(id).catch(() => undefined);
      }
    };
    view();
    window.addEventListener("focus", view);
    return () => window.removeEventListener("focus", view);
  }, [id]);
}
