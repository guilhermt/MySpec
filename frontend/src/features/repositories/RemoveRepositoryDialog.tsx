import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { removeSentence } from "@/features/repositories/repositories-page";
import { messageOf } from "@/lib/errors";
import { displayPaths } from "@/lib/paths";
import type { Repository } from "@/lib/wails";
import { removeRepository } from "@/store/actions";
import { useBoard } from "@/store/app-store";

export interface RemoveRepositoryDialogProps {
  repository: Repository;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** onRemoved is called once the repository is gone, before the dialog closes. */
  onRemoved?: () => void;
}

/**
 * RemoveRepositoryDialog is the last stop before a repository leaves MySpec. It opens on Cancel,
 * stays open while the repository is removed, and keeps a refusal in its footer.
 */
export function RemoveRepositoryDialog({
  repository,
  open,
  onOpenChange,
  onRemoved,
}: RemoveRepositoryDialogProps) {
  const board = useBoard(repository.boardId);
  const [removing, setRemoving] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const remove = async () => {
    if (removing) {
      return;
    }
    setRemoving(true);
    setRefusal(null);
    try {
      await removeRepository(repository.id);
      onRemoved?.();
      onOpenChange(false);
    } catch (failure) {
      setRefusal(displayPaths(messageOf(failure)));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While the call runs, the dialog stays: a refusal that comes back has its footer.
        if (!next && removing) {
          return;
        }
        if (next) {
          setRefusal(null);
        }
        onOpenChange(next);
      }}
      closeDisabled={removing}
      title={`Remove ${repository.fullName}?`}
      alert
    >
      <DialogBody>
        <p>{removeSentence(repository, board?.title ?? null)}</p>
        {board !== null && (
          <p className="text-ink-3">
            A reading of the board suggests it again while its issues are there.
          </p>
        )}
      </DialogBody>
      <DialogFooter {...(refusal === null ? {} : { refusal })}>
        <DialogCancel disabled={removing} />
        <Button
          variant="danger"
          loading={removing}
          loadingLabel="Removing…"
          onClick={() => void remove()}
        >
          Remove repository
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
