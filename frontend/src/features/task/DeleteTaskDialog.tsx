import { useState } from "react";
import { Button } from "@/components/system/Button";
import { DeletionPreview } from "@/components/system/DeletionPreview";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { deletionLines } from "@/features/task/deletion";
import { usePreviewReading } from "@/features/task/usePreviewReading";
import type { TaskSummary } from "@/lib/wails";
import { deleteTaskInPlace } from "@/store/actions";

export interface DeleteTaskDialogProps {
  task: TaskSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * DeleteTaskDialog is the last stop before a task is gone: a destructive dialog that opens on Cancel
 * and lists what the deletion destroys, read from git when it opens. The preview informs and never
 * blocks. A refusal stays in its footer; once the task is gone the state replaces the screen, and
 * the dialog goes with it.
 */
export function DeleteTaskDialog({ task, open, onOpenChange }: DeleteTaskDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const reading = usePreviewReading(task.id, open);

  const remove = async () => {
    if (deleting) {
      return;
    }
    setDeleting(true);
    setRefusal(null);
    const message = await deleteTaskInPlace(task.id);
    if (message !== null) {
      setDeleting(false);
      setRefusal(`Couldn't delete the task: ${message}`);
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
        <p>
          This removes the documents, the steps and every record of the task. It can't be undone.
        </p>
        <DeletionPreview state={deletionLines(task, reading)} />
      </DialogBody>
      <DialogFooter {...(refusal === null ? {} : { refusal })}>
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
