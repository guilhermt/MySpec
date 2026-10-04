import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { deleteTaskStays } from "@/features/history/archived";
import type { ArchivedTask } from "@/lib/wails";
import { deleteArchivedInPlace } from "@/store/actions";

export interface DeleteArchivedTaskDialogProps {
  task: ArchivedTask;
  /** neighbor is the entry of History that takes the place of the task: the focus goes to its row. */
  neighbor: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * DeleteArchivedTaskDialog is the last stop before an archived task is gone from History: a minimal,
 * destructive dialog that opens on Cancel. A refusal stays in its footer.
 */
export function DeleteArchivedTaskDialog({
  task,
  neighbor,
  open,
  onOpenChange,
}: DeleteArchivedTaskDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const remove = async () => {
    if (deleting) {
      return;
    }
    setDeleting(true);
    setRefusal(null);
    const message = await deleteArchivedInPlace("task", task.id, neighbor);
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
      title={`Delete “${task.name}”?`}
      alert
    >
      <DialogBody>
        <p>This removes the archived task and its documents from History. It can't be undone.</p>
        <p className="text-ink-3">{deleteTaskStays(task)}</p>
      </DialogBody>
      <DialogFooter {...(refusal === null ? {} : { refusal: `Couldn't delete it: ${refusal}` })}>
        <DialogCancel disabled={deleting} />
        <Button
          variant="danger"
          loading={deleting}
          loadingLabel="Deleting…"
          onClick={() => void remove()}
        >
          Delete task
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
