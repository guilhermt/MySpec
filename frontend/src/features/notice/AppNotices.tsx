import { AppNotice } from "@/components/system/AppNotice";
import { LeftoversNotice } from "@/features/notice/LeftoversNotice";
import { useAppStore, useError } from "@/store/app-store";

/**
 * AppNotices are the notices at the top of the main area, over the header of the place: the action
 * that failed last, and what the last deletion left on disk.
 */
export function AppNotices() {
  const error = useError();
  const setError = useAppStore((state) => state.setError);
  return (
    <>
      {error !== null && (
        <AppNotice label={error.label} detail={error.detail} onDismiss={() => setError(null)} />
      )}
      <LeftoversNotice />
    </>
  );
}
