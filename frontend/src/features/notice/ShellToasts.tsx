import { ICONS } from "@/components/system/icons";
import { Toast } from "@/components/system/Toast";
import { ToastRegion } from "@/components/system/ToastRegion";
import { useAnnouncement, useAppStore, useToasts } from "@/store/app-store";

/**
 * ShellToasts is the live region of the shell: the toasts of the tasks archived while not open,
 * and what the store announces.
 */
export function ShellToasts() {
  const announcement = useAnnouncement();
  const toasts = useToasts();
  const openArchived = useAppStore((state) => state.openArchived);
  const dismissToast = useAppStore((state) => state.dismissToast);
  return (
    <ToastRegion announcement={announcement}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          icon={ICONS.archive}
          text={`“${toast.name}” was archived`}
          action={{
            label: "Open in History",
            onClick: () => openArchived(toast.taskId),
          }}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </ToastRegion>
  );
}
