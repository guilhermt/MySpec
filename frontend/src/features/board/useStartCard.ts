import { useState } from "react";
import { messageOf } from "@/lib/errors";
import type { Board, BoardCard } from "@/lib/wails";
import { cloneRepository } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** StartOffer is what Start task asks before it goes on: to add the repository to the board. */
export type StartOffer = "add";

/** StartCard is Start task for one card, shared by the panel's button and the S key of the list. */
export interface StartCard {
  /**
   * run does what Start task does for a card: the given one, or the card of the hook. A card that
   * needs its clone first answers with the order to open its panel and focus the primary action.
   */
  run(target?: BoardCard): "focus-primary" | null;
  /** clone clones the repository of the card, and opens the dialog once it is there. */
  clone(): Promise<void>;
  busy: boolean;
  error: string | null;
  /** offer is whether Add to board is open for the card of the hook. */
  offer: StartOffer | null;
  setOffer(offer: StartOffer | null): void;
}

/**
 * useStartCard is Start task for the card open in a board view. onCloneRequested tells the view
 * which card asked for its clone.
 */
export function useStartCard(
  board: Board,
  card: BoardCard | null,
  onCloneRequested?: (key: string) => void,
): StartCard {
  const openNewTask = useAppStore((state) => state.openNewTask);
  const setPendingStart = useAppStore((state) => state.setPendingStart);
  // The offer, the clone running and its failure belong to the card they were
  // made for; another card starts with none of them.
  const [offered, setOffered] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);

  const forCard = (key: string | null) => key !== null && key === card?.key;

  return {
    run(target = card ?? undefined) {
      if (target === undefined) {
        return null;
      }
      switch (target.action) {
        case "start":
          openNewTask({ boardId: board.id, key: target.key });
          return null;
        case "clone":
          return "focus-primary";
        case "add_to_board":
          setFailed(null);
          setOffered(target.key);
          return null;
        default:
          return null;
      }
    },
    async clone() {
      if (card === null) {
        return;
      }
      setCloning(card.key);
      setFailed(null);
      onCloneRequested?.(card.key);
      try {
        const started = await cloneRepository(card.repositoryId);
        if (started) {
          setPendingStart({ boardId: board.id, key: card.key, repositoryId: card.repositoryId });
        }
      } catch (failure) {
        setFailed({ key: card.key, message: messageOf(failure) });
      } finally {
        setCloning(null);
      }
    },
    busy: forCard(cloning),
    error: failed !== null && forCard(failed.key) ? failed.message : null,
    offer: forCard(offered) ? "add" : null,
    setOffer(offer) {
      setFailed(null);
      setOffered(offer === null || card === null ? null : card.key);
    },
  };
}
