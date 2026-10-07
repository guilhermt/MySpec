import { AppNotice } from "@/components/system/AppNotice";
import { MachineNoticeBar } from "@/features/machine/MachineNoticeBar";
import { useAppStore, useError } from "@/store/app-store";

/**
 * AppNotices are the notices at the top of the main area, over the header of the place: the action
 * that failed last, when the action has no place of its own to say it, and under it what the machine lacks.
 */
export function AppNotices() {
  const error = useError();
  const setError = useAppStore((state) => state.setError);
  return (
    <>
      {error !== null && (
        <AppNotice label={error.label} detail={error.detail} onDismiss={() => setError(null)} />
      )}
      <MachineNoticeBar />
    </>
  );
}
