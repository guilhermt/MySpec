import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { choicesOf, chosenCloneOf } from "@/features/boards/board-dialog";
import { RepositoryLinkRow } from "@/features/boards/RepositoryLinkRow";
import { messageOf } from "@/lib/errors";
import type { BoardRepositoryOption } from "@/lib/wails";
import { addRepositoryToBoard, checkBoardRepository } from "@/store/actions";

export interface AddToBoardDialogProps {
  boardId: string;
  /** fullName is the owner/name of the repository the card is in. */
  fullName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** AddToBoardDialog adds the repository of a card to the board, tied to a clone when one is found. */
export function AddToBoardDialog({ boardId, fullName, open, onOpenChange }: AddToBoardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The form lives only while the dialog is open, so every opening checks the repository again. */}
      {open && <AddToBoardForm boardId={boardId} fullName={fullName} onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

type AddToBoardFormProps = Omit<AddToBoardDialogProps, "open">;

function AddToBoardForm({ boardId, fullName, onOpenChange }: AddToBoardFormProps) {
  const [option, setOption] = useState<BoardRepositoryOption | null>(null);
  const [chosenClones, setChosenClones] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkBoardRepository(boardId, fullName)
      .then((checked) => {
        if (!cancelled) {
          setOption({ ...checked, checked: true });
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setError(messageOf(failure));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, fullName]);

  const [choice] = option === null ? [] : choicesOf([option], chosenClones);

  const add = async () => {
    if (choice === undefined) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addRepositoryToBoard(boardId, choice);
      onOpenChange(false);
    } catch (failure) {
      setError(messageOf(failure));
      setBusy(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{`Add ${fullName} to the board`}</DialogTitle>
        <DialogDescription>The board manages the repository from now on.</DialogDescription>
      </DialogHeader>
      {option === null ? (
        busy && <p className="text-sm text-muted-foreground">Checking the repository…</p>
      ) : (
        <ul className="rounded-md border">
          <RepositoryLinkRow
            option={option}
            chosenClone={chosenCloneOf(option, chosenClones)}
            disabled={busy}
            onCheckedChange={(checked) => setOption({ ...option, checked })}
            onCloneChange={(path) => setChosenClones({ [option.fullName]: path })}
          />
        </ul>
      )}
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button disabled={busy || choice === undefined} onClick={() => void add()}>
          Add to board
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
