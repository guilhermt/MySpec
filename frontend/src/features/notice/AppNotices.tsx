import { AppNotice } from "@/components/system/AppNotice";
import { useAppStore, useError } from "@/store/app-store";

/**
 * AppNotices is the notice at the top of the main area, over the header of the place: the action
 * that failed last, when the action has no place of its own to say it.
 */
export function AppNotices() {
  const error = useError();
  const setError = useAppStore((state) => state.setError);
  if (error === null) {
    return null;
  }
  return <AppNotice label={error.label} detail={error.detail} onDismiss={() => setError(null)} />;
}
