import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { ICONS } from "@/components/system/icons";
import { Tooltip } from "@/components/system/Tooltip";
import { AddToBoardDialog } from "@/features/board/AddToBoardDialog";
import type { PanelActions, PrimaryAction } from "@/features/board/card-panel";
import type { StartCard } from "@/features/board/useStartCard";
import { messageOf } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { Board, BoardCard } from "@/lib/wails";
import { changeRepositoryPath } from "@/store/actions";

export interface CardActionsProps {
  board: Board;
  card: BoardCard;
  actions: PanelActions;
  start: StartCard;
  /** stripId is the id of the strip of a card out of the reading, which the dashed actions describe. */
  stripId: string | null;
  /** onAdded runs once the repository of the card is on the board. */
  onAdded: () => void;
  /** onDiscuss opens a discussion of this card alone. */
  onDiscuss: () => void;
}

const REASON = "text-(length:--text-meta) leading-(--leading-meta)";

/**
 * CardActions are the actions of the panel of a card: its one primary, Change path… when the clone
 * is missing, and Discuss, with the reason of the case under them.
 */
export function CardActions({
  board,
  card,
  actions,
  start,
  stripId,
  onAdded,
  onDiscuss,
}: CardActionsProps) {
  const root = useRef<HTMLDivElement>(null);
  const reasonId = `card-reason-${card.key}`;
  const discussReasonId = `card-discuss-reason-${card.key}`;
  const [pathError, setPathError] = useState<string | null>(null);
  // Change path… that worked moves the focus to the primary the card gets.
  const focusAfterPath = useRef(false);
  const { primary, reason } = actions;

  useEffect(() => {
    if (focusAfterPath.current && primary?.kind === "start" && !primary.disabled) {
      focusAfterPath.current = false;
      root.current?.querySelector<HTMLElement>("[data-primary]")?.focus();
    }
  }, [primary]);

  const changePath = async () => {
    setPathError(null);
    try {
      // A cancelled chooser leaves the card as it was, and the focus where it is.
      focusAfterPath.current = await changeRepositoryPath(card.repositoryId);
    } catch (failure) {
      setPathError(messageOf(failure));
    }
  };

  const describedBy = stripId ?? (reason === null ? undefined : reasonId);
  const primaryButton = (action: PrimaryAction) => {
    const common = { variant: "primary", size: "sm", "data-primary": "" } as const;
    switch (action.kind) {
      case "start":
        return action.disabled ? (
          <Button
            {...common}
            disabled
            {...(describedBy !== undefined ? { reasonId: describedBy } : {})}
          >
            Start task
          </Button>
        ) : (
          <Button {...common} shortcut="S" onClick={() => start.run()}>
            Start task
          </Button>
        );
      case "add":
        return (
          <Button {...common} shortcut="S" onClick={() => start.run()}>
            Start task
          </Button>
        );
      case "clone":
        return (
          <Tooltip content="Clone, then open New task · S">
            <Button
              {...common}
              icon={ICONS.clone}
              shortcut="S"
              onClick={() => {
                if (!start.busy) {
                  void start.clone();
                }
              }}
            >
              Clone and continue
            </Button>
          </Tooltip>
        );
      case "cloning":
        return <Button {...common} loading loadingLabel={`Cloning ${action.repository}…`} />;
      case "retry-clone":
        return (
          <Button
            {...common}
            shortcut="S"
            onClick={() => {
              if (!start.busy) {
                void start.clone();
              }
            }}
          >
            Try the clone again
          </Button>
        );
    }
  };

  const discussDashed = actions.discuss.disabled;
  const discussDescribedBy = actions.discussReason !== null ? discussReasonId : stripId;
  const discuss = (
    <Button
      size="sm"
      {...(discussDashed
        ? {
            disabled: true,
            ...(discussDescribedBy !== null ? { reasonId: discussDescribedBy } : {}),
          }
        : { shortcut: "D", onClick: onDiscuss })}
    >
      Discuss
    </Button>
  );

  return (
    <div ref={root} data-panel-actions="" className="flex flex-col gap-(--space-2)">
      <div className="flex flex-wrap items-center gap-(--space-2)">
        {primary !== null && primaryButton(primary)}
        {actions.changePath && (
          <Button size="sm" onClick={() => void changePath()}>
            Change path…
          </Button>
        )}
        {actions.discussReason !== null ? (
          <Tooltip content={actions.discussReason}>{discuss}</Tooltip>
        ) : (
          discuss
        )}
      </div>
      {actions.discussReason !== null && (
        <span id={discussReasonId} className="sr-only">
          {actions.discussReason}
        </span>
      )}
      {reason !== null && (
        <p
          id={reasonId}
          {...(reason.tone === "error" ? { role: "alert" } : {})}
          className={cn(
            REASON,
            "break-words",
            reason.tone === "error" ? "text-state-error" : "text-ink-3",
          )}
        >
          {reason.text}
        </p>
      )}
      {pathError !== null && (
        <p role="alert" className={cn(REASON, "break-words text-state-error")}>
          {pathError}
        </p>
      )}
      <AddToBoardDialog
        boardId={board.id}
        fullName={card.repository}
        open={start.offer === "add"}
        onOpenChange={(open) => start.setOffer(open ? "add" : null)}
        onAdded={onAdded}
      />
    </div>
  );
}
