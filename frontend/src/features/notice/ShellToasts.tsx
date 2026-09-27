import { ToastRegion } from "@/components/system/ToastRegion";
import { useAnnouncement } from "@/store/app-store";

/** ShellToasts is the live region of the shell, saying what the store announces. */
export function ShellToasts() {
  const announcement = useAnnouncement();
  return <ToastRegion announcement={announcement} />;
}
