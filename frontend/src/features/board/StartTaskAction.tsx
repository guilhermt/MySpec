import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { AddToBoardDialog } from "@/features/board/AddToBoardDialog";
import { actionHint, isCheckable } from "@/features/board/board-view";
import type { StartCard } from "@/features/board/useStartCard";
import { messageOf } from "@/lib/errors";
import type { Board, BoardCard } from "@/lib/wails";
import { changeRepositoryPath } from "@/store/actions";
import { useAppStore, useRepository } from "@/store/app-store";

export interface StartTaskActionProps {
  board: Board;
  card: BoardCard;
  start: StartCard;
  /** onDiscuss opens a discussion of this card alone. */
  onDiscuss: () => void;
}

/** StartTaskAction is Start task and Discuss for the card in the detail, or what stands in their way. */
export function StartTaskAction({ board, card, start, onDiscuss }: StartTaskActionProps) {
  const app = useAppStore((state) => state.app);
  const repository = useRepository(card.repositoryId);
  const [pathError, setPathError] = useState<string | null>(null);
  const hint = actionHint(card, app);
  // A card of a repository the board does not manage has no discussion to open.
  const checkable = isCheckable(card, app, board.id);

  const changePath = async () => {
    setPathError(null);
    try {
      await changeRepositoryPath(card.repositoryId);
    } catch (failure) {
      setPathError(messageOf(failure));
    }
  };

  const startButton = (disabled: boolean) => (
    <Button size="sm" data-primary-action disabled={disabled} onClick={() => start.run()}>
      Start task
      {!disabled && <Kbd>S</Kbd>}
    </Button>
  );
  const discussButton = (
    <Button variant="outline" size="sm" disabled={!checkable} onClick={onDiscuss}>
      Discuss
      {checkable && <Kbd>D</Kbd>}
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
      return (
        <div data-panel-actions className="flex items-center gap-2">
          {startButton(false)}
          {discussButton}
        </div>
      );
    case "clone":
      return (
        <div data-panel-actions className="flex flex-col items-start gap-2">
          {repository?.cloning ? (
            <div className="flex items-center gap-2">
              <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                {`Cloning ${card.repository}…`}
              </p>
              {discussButton}
            </div>
          ) : (
            <>
              {hintText}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  data-primary-action
                  aria-busy={start.busy}
                  onClick={() => {
                    if (!start.busy) {
                      void start.clone();
                    }
                  }}
                >
                  Clone and continue
                </Button>
                {discussButton}
              </div>
            </>
          )}
          {alert(repository?.cloneError ?? null)}
          {alert(start.error)}
        </div>
      );
    case "clone_missing":
      return (
        <div data-panel-actions className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            {startButton(true)}
            {discussButton}
          </div>
          {hintText}
          <Button variant="outline" size="sm" onClick={() => void changePath()}>
            Change path
          </Button>
          {alert(pathError)}
        </div>
      );
    case "add_to_board":
      return (
        <div data-panel-actions className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            {startButton(false)}
            {discussButton}
          </div>
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
        <div data-panel-actions className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            {startButton(true)}
            {discussButton}
          </div>
          {hintText}
        </div>
      );
    default:
      // A card with a task of its own, or closed, still opens a discussion, and
      // its action says nothing about the repository: the hint belongs here too.
      return (
        <div data-panel-actions className="flex flex-col items-start gap-2">
          {discussButton}
          {!checkable && (
            <p className="text-sm text-muted-foreground">
              {`${card.repository} isn't managed by this board.`}
            </p>
          )}
        </div>
      );
  }
}
