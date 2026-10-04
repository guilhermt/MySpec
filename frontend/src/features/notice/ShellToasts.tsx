import { useLayoutEffect, useRef, useState } from "react";
import { Toast } from "@/components/system/Toast";
import { ToastRegion } from "@/components/system/ToastRegion";
import { toastOf } from "@/features/notice/toasts";
import {
  type Toast as ToastEntry,
  useAnnouncement,
  useAppStore,
  useToasts,
} from "@/store/app-store";

/**
 * ShellToasts is the live region of the shell: the toasts of the tasks, reviews and discussions archived while not open,
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

  const now = Date.now();
  const entries = [
    ...pushedOut.map((toast) => ({ toast, leaving: true })),
    ...toasts.map((toast) => ({ toast, leaving: false })),
  ];
  return (
    <ToastRegion announcement={announcement}>
      {entries.map(({ toast, leaving }) => {
        const { icon, text, detail } = toastOf(toast, now);
        return (
          <Toast
            key={toast.id}
            icon={icon}
            text={text}
            {...(detail === null ? {} : { detail })}
            leaving={leaving}
            action={{
              label: "Open in History",
              onClick: () => openInHistory(toast.kind, toast.id),
            }}
            onDismiss={() => {
              if (leaving) {
                setPushedOut((left) => left.filter((entry) => entry.id !== toast.id));
              } else {
                dismissed.current.add(toast.id);
                dismissToast(toast.id);
              }
            }}
          />
        );
      })}
    </ToastRegion>
  );
}
