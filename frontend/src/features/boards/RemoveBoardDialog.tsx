import { useEffect, useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { SunkenLine } from "@/components/system/SunkenLine";
import { removalLines, removalSentence } from "@/features/boards/boards-page";
import { messageOf } from "@/lib/errors";
import type { Board, BoardRemoval } from "@/lib/wails";
import { previewRemoveBoard, removeBoard } from "@/store/actions";

/** Preview is the reading of what removing the board does, as the dialog holds it. */
type Preview =
  | { status: "reading" }
  | { status: "ready"; removal: BoardRemoval }
  | { status: "failed"; message: string };

export interface RemoveBoardDialogProps {
  board: Board;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** onRemoved is called once the board is gone, before the dialog closes. */
  onRemoved?: () => void;
}

/**
 * RemoveBoardDialog is the last stop before a board leaves MySpec, saying what happens to its
 * repositories. It opens on Cancel, stays open while the board is removed, and keeps a refusal in
 * its footer. A preview that can't be read doesn't stop the removal.
 */
export function RemoveBoardDialog({
  board,
  open,
  onOpenChange,
  onRemoved,
}: RemoveBoardDialogProps) {
  const [preview, setPreview] = useState<Preview>({ status: "reading" });
  const [removing, setRemoving] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPreview({ status: "reading" });
    setRefusal(null);
    let stale = false;
    previewRemoveBoard(board.id)
      .then((removal) => {
        if (!stale) setPreview({ status: "ready", removal });
      })
      .catch((reason: unknown) => {
        if (!stale) setPreview({ status: "failed", message: messageOf(reason) });
      });
    return () => {
      stale = true;
    };
  }, [open, board.id]);

  const remove = async () => {
    if (removing) {
      return;
    }
    setRemoving(true);
    setRefusal(null);
    try {
      await removeBoard(board.id);
      onRemoved?.();
      onOpenChange(false);
    } catch (failure) {
      setRefusal(messageOf(failure));
    } finally {
      setRemoving(false);
    }
  };

  const lines = preview.status === "ready" ? removalLines(board, preview.removal) : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While the call runs, the dialog stays: a refusal that comes back has its footer.
        if (!next && removing) {
          return;
        }
        onOpenChange(next);
      }}
      closeDisabled={removing}
      title={`Remove ${board.title}?`}
      alert
    >
      <DialogBody>
        <p>
          {preview.status === "ready"
            ? removalSentence(preview.removal)
            : "The board leaves MySpec."}
        </p>
        {preview.status === "failed" && (
          <p className="text-ink-3">
            {`Couldn't tell what happens to its repositories: ${preview.message}`}
          </p>
        )}
        {lines.length > 0 && (
          <SunkenLine>
            {lines.map(({ label, names }) => (
              <span key={label} className="block">
                <span className="font-medium">{label}</span> {names}
              </span>
            ))}
          </SunkenLine>
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
          Remove board
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
