import { useState } from "react";
import { Presence } from "@/components/system/Presence";
import { Toast } from "@/components/system/Toast";
import { ToastRegion } from "@/components/system/ToastRegion";
import { toastOf } from "@/features/notice/toasts";
import {
  type Toast as ToastEntry,
  useAnnouncement,
  useAppStore,
  useToasts,
} from "@/store/app-store";

// stay is the toasts on screen: the ones of the store, and the ones it let go of, in the place they were.
function stay(kept: readonly ToastEntry[], toasts: readonly ToastEntry[]): ToastEntry[] {
  const held = kept.map((toast) => toasts.find((next) => next.id === toast.id) ?? toast);
  return [...held, ...toasts.filter((next) => !kept.some((toast) => toast.id === next.id))];
}

/**
 * ShellToasts is the live region of the shell: the toasts of the tasks, reviews and discussions archived while not open,
 * and what the store announces. A toast a newer one pushes out of the store stays for its exit.
 */
export function ShellToasts() {
  const announcement = useAnnouncement();
  const toasts = useToasts();
  const openInHistory = useAppStore((state) => state.openInHistory);
  const dismissToast = useAppStore((state) => state.dismissToast);
  const [kept, setKept] = useState<readonly ToastEntry[]>(toasts);
  const [seen, setSeen] = useState(toasts);
  if (seen !== toasts) {
    setSeen(toasts);
    setKept(stay(kept, toasts));
  }

  const now = Date.now();
  const forget = (id: string) => setKept((left) => left.filter((toast) => toast.id !== id));
  return (
    <ToastRegion announcement={announcement}>
      {stay(kept, toasts).map((toast) => {
        const inStore = toasts.some((next) => next.id === toast.id);
        const { icon, text, detail } = toastOf(toast, now);
        return (
          <Presence key={toast.id} onGone={() => forget(toast.id)}>
            {inStore && (
              <Toast
                icon={icon}
                text={text}
                {...(detail === null ? {} : { detail })}
                action={{
                  label: "Open in History",
                  onClick: () => openInHistory(toast.kind, toast.id),
                }}
                onDismiss={() => {
                  forget(toast.id);
                  dismissToast(toast.id);
                }}
              />
            )}
          </Presence>
        );
      })}
    </ToastRegion>
  );
}
