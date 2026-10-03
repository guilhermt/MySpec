import { useEffect, useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { BoardRepositoryRow } from "@/features/boards/BoardRepositoryRow";
import { choicesOf, chosenCloneOf } from "@/features/boards/board-dialog";
import { messageOf } from "@/lib/errors";
import type { BoardRepositoryOption } from "@/lib/wails";
import { addRepositoryToBoard, checkBoardRepository } from "@/store/actions";
import { useRepositories } from "@/store/app-store";

export interface AddToBoardDialogProps {
  boardId: string;
  /** fullName is the owner/name of the repository the card is in. */
  fullName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** onAdded runs once the repository is on the board and the dialog has closed. */
  onAdded: () => void;
}

/** AddToBoardDialog adds the repository of a card to the board, tied to a clone when one is found. */
export function AddToBoardDialog({
  boardId,
  fullName,
  open,
  onOpenChange,
  onAdded,
}: AddToBoardDialogProps) {
  const repositories = useRepositories();
  const [option, setOption] = useState<BoardRepositoryOption | null>(null);
  const [chosenClones, setChosenClones] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every opening checks the repository again.
  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setOption(null);
    setChosenClones({});
    setError(null);
    setAdding(false);
    setChecking(true);
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
          setChecking(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, boardId, fullName]);

  const [choice] = option === null ? [] : choicesOf([option], chosenClones);
  const busy = checking || adding;

  const add = async () => {
    if (choice === undefined || busy) {
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await addRepositoryToBoard(boardId, choice);
      setAdding(false);
      onOpenChange(false);
      onAdded();
    } catch (failure) {
      setError(messageOf(failure));
      setAdding(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title={`Add ${fullName} to the board`}
      subtitle="The board manages the repository from now on."
      onConfirm={() => void add()}
    >
      <DialogBody>
        {option === null ? (
          checking && <p>Checking the repository…</p>
        ) : (
          <ul className="rounded-md border border-line-2">
            <BoardRepositoryRow
              option={option}
              repository={
                repositories.find((repository) => repository.id === option.repositoryId) ?? null
              }
              consequence=""
              chosenClone={chosenCloneOf(option, chosenClones)}
              disabled={busy}
              onCheckedChange={(checked) => setOption({ ...option, checked })}
              onCloneChange={(path) => setChosenClones({ [option.fullName]: path })}
            />
          </ul>
        )}
      </DialogBody>
      <DialogFooter {...(error !== null ? { refusal: error } : {})}>
        <DialogCancel />
        <Button
          variant="primary"
          loading={adding}
          loadingLabel="Adding…"
          disabled={(checking && !adding) || choice === undefined}
          onClick={() => void add()}
        >
          Add to board
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
