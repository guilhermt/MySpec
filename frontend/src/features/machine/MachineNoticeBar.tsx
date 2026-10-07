import { MachineNotice } from "@/components/system/MachineNotice";
import { noticeText } from "@/features/machine/machine";
import { useAppStore, useLocation, useMachine, useWelcomeMode } from "@/store/app-store";

/**
 * MachineNoticeBar is the notice of what the machine lacks, at the top of the main area: it shows while
 * the check of the opening found something missing and no check since found nothing, outside the
 * welcome, outside Settings › Machine and until it is dismissed.
 */
export function MachineNoticeBar() {
  const machine = useMachine();
  const welcome = useWelcomeMode();
  const location = useLocation();
  const dismissed = useAppStore((state) => state.machineNoticeDismissed);
  const dismiss = useAppStore((state) => state.dismissMachineNotice);
  const openSettings = useAppStore((state) => state.openSettings);
  const text = noticeText(machine);
  if (
    !machine.notice ||
    welcome ||
    dismissed ||
    text === null ||
    (location.kind === "settings" && location.section === "machine")
  ) {
    return null;
  }
  return <MachineNotice {...text} onOpen={() => openSettings("machine")} onDismiss={dismiss} />;
}
