import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { counted } from "@/lib/situations";
import type { Draft } from "@/lib/wails";
import { deleteDiscussionInPlace } from "@/store/actions";

export interface DeleteDiscussionDialogProps {
  /** discussion is the active or the archived discussion to delete. */
  discussion: { id: string; title: string; drafts: readonly Draft[] };
  /** archived says the discussion is in History, which the deletion then has nothing to say about. */
  archived?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * DeleteDiscussionDialog is the last stop before a discussion is gone: a minimal, destructive dialog
 * that opens on Cancel. A refusal stays in its footer.
 */
export function DeleteDiscussionDialog({
  discussion,
  archived = false,
  open,
  onOpenChange,
}: DeleteDiscussionDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const published = discussion.drafts.filter((draft) => draft.published).length;

  const remove = async () => {
    setDeleting(true);
    setRefusal(null);
    const message = await deleteDiscussionInPlace(discussion.id);
    setDeleting(false);
    if (message === null) {
      onOpenChange(false);
    } else {
      setRefusal(message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setRefusal(null);
        }
        onOpenChange(next);
      }}
      title={`Delete “${discussion.title}”?`}
      alert
    >
      <DialogBody>
        <p>
          {archived
            ? "The conversation, the document and the drafts go away."
            : "The conversation, the document and the drafts go away, and the discussion doesn't go to History."}
          {published > 0 && ` What was published on GitHub stays: ${counted(published, "issue")}.`}
        </p>
        <p className="text-ink-3">
          A task started from one of its cards loses the document in its context.
        </p>
      </DialogBody>
      <DialogFooter {...(refusal === null ? {} : { refusal })}>
        <DialogCancel />
        <Button
          variant="danger"
          loading={deleting}
          loadingLabel="Deleting…"
          onClick={() => void remove()}
        >
          Delete discussion
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
