import { Archive, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore, useArchivedNotice } from "@/store/app-store";

/** DISMISS_AFTER is how long the notice stays before it sees itself out. */
const DISMISS_AFTER = 10_000;

/**
 * ArchivedNotice announces the task that was just archived. Archiving is
 * the app's doing, not the user's, so it says so quietly and offers the way
 * into the history where the task now lives.
 */
export function ArchivedNotice() {
  const notice = useArchivedNotice();
  const openArchived = useAppStore((state) => state.openArchived);
  const dismiss = useAppStore((state) => state.dismissArchivedNotice);

  // The notice is news, not a decision to make: it goes on its own.
  useEffect(() => {
    if (notice === null) {
      return;
    }
    const timer = setTimeout(dismiss, DISMISS_AFTER);
    return () => clearTimeout(timer);
  }, [notice, dismiss]);

  if (notice === null) {
    return null;
  }

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-popover px-4 py-2 text-sm shadow-md">
        <Archive aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate">{`“${notice.name}” was archived.`}</span>
        <Button
          variant="link"
          size="sm"
          onClick={() => {
            openArchived(notice.id);
            dismiss();
          }}
        >
          Open in history
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => dismiss()}>
          <X />
        </Button>
      </div>
    </div>
  );
}
