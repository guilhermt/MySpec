import type { ReactNode } from "react";

export interface ToastRegionProps {
  /** announcement is said once, visually hidden, in the same live container as the toasts. */
  announcement: { id: number; text: string } | null;
  /** children are the toasts. */
  children?: ReactNode;
}

/**
 * ToastRegion is the one live region of the app, bottom left of the main
 * area: the toasts and the announcements share it, so a screen reader hears
 * each once. A new announcement id remounts its text, which is said again.
 */
export function ToastRegion({ announcement, children }: ToastRegionProps) {
  return (
    <div className="toasts" role="status" aria-live="polite" data-live-region="">
      {children}
      {announcement !== null && (
        <span key={announcement.id} className="sr-only">
          {announcement.text}
        </span>
      )}
    </div>
  );
}
