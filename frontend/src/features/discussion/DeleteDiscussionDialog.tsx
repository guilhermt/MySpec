import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { counted } from "@/lib/situations";
import type { Draft } from "@/lib/wails";
import { deleteArchivedInPlace, deleteDiscussionInPlace } from "@/store/actions";

// archivedStays is what the deletion of an archived discussion leaves on GitHub: the issues it published.
function archivedStays(published: number): string {
  if (published === 0) {
    return "Nothing changes on GitHub.";
  }
  return published === 1
    ? "Nothing changes on GitHub: the issue it published stays."
    : `Nothing changes on GitHub: the ${published} issues it published stay.`;
}

export interface DeleteDiscussionDialogProps {
  /** discussion is the active or the archived discussion to delete. */
  discussion: { id: string; title: string; drafts: readonly Draft[] };
  /** archived says the discussion is in History: the text is the one of an item that is only kept there. */
  archived?: boolean;
  /** neighbor is the entry of History that takes the place of an archived discussion: the focus goes to its row. */
  neighbor?: string | null;
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
  neighbor = null,
  open,
  onOpenChange,
}: DeleteDiscussionDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const published = discussion.drafts.filter((draft) => draft.published).length;

  const remove = async () => {
    if (deleting) {
      return;
    }
    setDeleting(true);
    setRefusal(null);
    const message = archived
      ? await deleteArchivedInPlace("discussion", discussion.id, neighbor)
      : await deleteDiscussionInPlace(discussion.id);
    setDeleting(false);
    if (message === null) {
      onOpenChange(false);
    } else {
      setRefusal(archived ? `Couldn't delete it: ${message}` : message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While the call runs, the dialog stays: a refusal that comes back has its footer.
        if (!next && deleting) {
          return;
        }
        if (!next) {
          setRefusal(null);
        }
        onOpenChange(next);
      }}
      closeDisabled={deleting}
      title={`Delete “${discussion.title}”?`}
      alert
    >
      <DialogBody>
        {archived ? (
          <>
            <p>
              This removes the archived discussion, its document, its drafts and its conversation
              from History. It can't be undone.
            </p>
            <p className="text-ink-3">
              {`${archivedStays(published)} A task started from one of its cards loses the document in its context.`}
            </p>
          </>
        ) : (
          <>
            <p>
              The conversation, the document and the drafts go away, and the discussion doesn't go
              to History.
              {published > 0 &&
                ` What was published on GitHub stays: ${counted(published, "issue")}.`}
            </p>
            <p className="text-ink-3">
              A task started from one of its cards loses the document in its context.
            </p>
          </>
        )}
      </DialogBody>
      <DialogFooter {...(refusal === null ? {} : { refusal })}>
        <DialogCancel disabled={deleting} />
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
