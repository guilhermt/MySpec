import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { removalText } from "@/features/boards/boards-page";
import { messageOf } from "@/lib/errors";
import type { Board, BoardRemoval } from "@/lib/wails";
import { previewRemoveBoard, removeBoard } from "@/store/actions";

export interface RemoveBoardDialogProps {
  board: Board;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** RemoveBoardDialog is the last stop before a board leaves MySpec, saying what happens to its repositories. */
export function RemoveBoardDialog({ board, open, onOpenChange }: RemoveBoardDialogProps) {
  const [removal, setRemoval] = useState<BoardRemoval | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setRemoval(null);
    setError(null);
    let cancelled = false;
    void previewRemoveBoard(board.id).then((preview) => {
      if (!cancelled) {
        setRemoval(preview);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, board.id]);

  const remove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await removeBoard(board.id);
      onOpenChange(false);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Remove ${board.title}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {removal === null ? "The board leaves MySpec." : removalText(removal)}
          </AlertDialogDescription>
          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={removing}
            onClick={(event) => {
              // The dialog closes once the board is gone, or stays with the reason.
              event.preventDefault();
              void remove();
            }}
          >
            Remove board
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
