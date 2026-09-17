import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { AddToBoardDialog } from "@/features/board/AddToBoardDialog";
import { actionHint } from "@/features/board/board-view";
import type { StartCard } from "@/features/board/useStartCard";
import { messageOf } from "@/lib/errors";
import type { Board, BoardCard } from "@/lib/wails";
import { changeRepositoryPath } from "@/store/actions";
import { useAppStore, useRepository } from "@/store/app-store";

export interface StartTaskActionProps {
  board: Board;
  card: BoardCard;
  start: StartCard;
}

/** StartTaskAction is Start task for the card in the detail, or what stands in its way. */
export function StartTaskAction({ board, card, start }: StartTaskActionProps) {
  const app = useAppStore((state) => state.app);
  const repository = useRepository(card.repositoryId);
  const [pathError, setPathError] = useState<string | null>(null);
  const hint = actionHint(card, app);

  const changePath = async () => {
    setPathError(null);
    try {
      await changeRepositoryPath(card.repositoryId);
    } catch (failure) {
      setPathError(messageOf(failure));
    }
  };

  const startButton = (disabled: boolean) => (
    <Button size="sm" disabled={disabled} onClick={() => start.run()}>
      Start task
      {!disabled && <Kbd>S</Kbd>}
    </Button>
  );
  const hintText = hint !== null && <p className="text-sm text-muted-foreground">{hint}</p>;
  const alert = (message: string | null) =>
    message !== null &&
    message !== "" && (
      <p role="alert" className="break-all text-sm text-destructive">
        {message}
      </p>
    );

  switch (card.action) {
    case "start":
      return <div className="flex items-center gap-2">{startButton(false)}</div>;
    case "clone":
      return (
        <div className="flex flex-col items-start gap-2">
          {repository?.cloning ? (
            <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
              {`Cloning ${card.repository}…`}
            </p>
          ) : start.offer === "clone" ? (
            <>
              {hintText}
              <Button size="sm" disabled={start.busy} onClick={() => void start.clone()}>
                Clone and continue
              </Button>
            </>
          ) : (
            startButton(false)
          )}
          {alert(repository?.cloneError ?? null)}
          {alert(start.error)}
        </div>
      );
    case "clone_missing":
      return (
        <div className="flex flex-col items-start gap-2">
          {startButton(true)}
          {hintText}
          <Button variant="outline" size="sm" onClick={() => void changePath()}>
            Change path
          </Button>
          {alert(pathError)}
        </div>
      );
    case "add_to_board":
      return (
        <div className="flex flex-col items-start gap-2">
          {startButton(false)}
          {hintText}
          <AddToBoardDialog
            boardId={board.id}
            fullName={card.repository}
            open={start.offer === "add"}
            onOpenChange={(open) => start.setOffer(open ? "add" : null)}
          />
        </div>
      );
    case "other_board":
      return (
        <div className="flex flex-col items-start gap-2">
          {startButton(true)}
          {hintText}
        </div>
      );
    default:
      return null;
  }
}
