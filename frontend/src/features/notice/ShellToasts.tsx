import { useLayoutEffect, useRef, useState } from "react";
import { ICONS } from "@/components/system/icons";
import { Toast } from "@/components/system/Toast";
import { ToastRegion } from "@/components/system/ToastRegion";
import {
  type Toast as ToastEntry,
  useAnnouncement,
  useAppStore,
  useToasts,
} from "@/store/app-store";

/**
 * ShellToasts is the live region of the shell: the toasts of the tasks archived while not open,
 * and what the store announces. A toast a newer one pushes out of the store stays for its exit.
 */
export function ShellToasts() {
  const announcement = useAnnouncement();
  const toasts = useToasts();
  const openInHistory = useAppStore((state) => state.openInHistory);
  const dismissToast = useAppStore((state) => state.dismissToast);
  const [pushedOut, setPushedOut] = useState<readonly ToastEntry[]>([]);
  const shown = useRef(toasts);
  // The toasts that already played their exit before the store let them go.
  const dismissed = useRef(new Set<string>());

  useLayoutEffect(() => {
    const gone = shown.current.filter(
      (toast) => !dismissed.current.has(toast.id) && !toasts.some((next) => next.id === toast.id),
    );
    shown.current = toasts;
    dismissed.current.clear();
    if (gone.length > 0) {
      setPushedOut((leaving) => [...leaving, ...gone]);
    }
  }, [toasts]);

  const entries = [
    ...pushedOut.map((toast) => ({ toast, leaving: true })),
    ...toasts.map((toast) => ({ toast, leaving: false })),
  ];
  return (
    <ToastRegion announcement={announcement}>
      {entries.map(({ toast, leaving }) => (
        <Toast
          key={toast.id}
          icon={ICONS.archive}
          text={`“${toast.name}” was archived`}
          leaving={leaving}
          action={{ label: "Open in History", onClick: () => openInHistory("task", toast.taskId) }}
          onDismiss={() => {
            if (leaving) {
              setPushedOut((left) => left.filter((entry) => entry.id !== toast.id));
            } else {
              dismissed.current.add(toast.id);
              dismissToast(toast.id);
            }
          }}
        />
      ))}
    </ToastRegion>
  );
}
