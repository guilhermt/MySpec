import { useEffect } from "react";
import { ArchiveDiscussionDialog } from "@/features/discussion/ArchiveDiscussionDialog";
import { DeleteDiscussionDialog } from "@/features/discussion/DeleteDiscussionDialog";
import type { DiscussionSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

export interface DiscussionDialogsProps {
  discussion: DiscussionSummary;
}

/**
 * DiscussionDialogs draws the dialog of the discussion that is open, which the ⋯ and the bar open
 * through the store. One that is still open when the screen goes away closes with it.
 */
export function DiscussionDialogs({ discussion }: DiscussionDialogsProps) {
  const dialog = useAppStore((state) => state.discussionDialog);
  const closeDiscussionDialog = useAppStore((state) => state.closeDiscussionDialog);
  useEffect(() => closeDiscussionDialog, [closeDiscussionDialog]);

  const kind = dialog?.discussionId === discussion.id ? dialog.kind : null;
  const subject = { id: discussion.id, title: discussion.title, drafts: discussion.drafts ?? [] };
  const onOpenChange = (open: boolean) => {
    if (!open) {
      closeDiscussionDialog();
    }
  };

  return (
    <>
      <ArchiveDiscussionDialog
        discussion={subject}
        open={kind === "archive"}
        onOpenChange={onOpenChange}
      />
      <DeleteDiscussionDialog
        discussion={subject}
        open={kind === "delete"}
        onOpenChange={onOpenChange}
      />
    </>
  );
}
