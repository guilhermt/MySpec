import { useState } from "react";
import { messageOf } from "@/lib/errors";
import type { Board, BoardCard } from "@/lib/wails";
import { cloneRepository } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** StartOffer is what Start task asks before it goes on: to clone the repository, or to add it to the board. */
export type StartOffer = "clone" | "add";

/** StartCard is Start task for one card, shared by the detail's button and the S key of the list. */
export interface StartCard {
  /** run does what Start task does for a card: the given one, or the card of the hook. */
  run(target?: BoardCard): void;
  /** clone clones the repository of the card, and opens the dialog once it is there. */
  clone(): Promise<void>;
  busy: boolean;
  error: string | null;
  /** offer is what Start task asks for the card of the hook; null when nothing. */
  offer: StartOffer | null;
  setOffer(offer: StartOffer | null): void;
}

/** useStartCard is Start task for the card open in a board view. */
export function useStartCard(board: Board, card: BoardCard | null): StartCard {
  const openNewTask = useAppStore((state) => state.openNewTask);
  const setPendingStart = useAppStore((state) => state.setPendingStart);
  // The offer belongs to the card it was made for; another card starts with none.
  const [offered, setOffered] = useState<{ key: string; offer: StartOffer } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offerFor = (key: string, offer: StartOffer | null) => {
    setError(null);
    setOffered(offer === null ? null : { key, offer });
  };

  return {
    run(target = card ?? undefined) {
      if (target === undefined) {
        return;
      }
      switch (target.action) {
        case "start":
          openNewTask({ boardId: board.id, key: target.key });
          break;
        case "clone":
          offerFor(target.key, "clone");
          break;
        case "add_to_board":
          offerFor(target.key, "add");
          break;
        default:
          break;
      }
    },
    async clone() {
      if (card === null) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const started = await cloneRepository(card.repositoryId);
        if (started) {
          setPendingStart({ boardId: board.id, key: card.key, repositoryId: card.repositoryId });
        }
      } catch (failure) {
        setError(messageOf(failure));
      } finally {
        setBusy(false);
      }
    },
    busy,
    error,
    offer: offered !== null && offered.key === card?.key ? offered.offer : null,
    setOffer(offer) {
      if (card !== null) {
        offerFor(card.key, offer);
      }
    },
  };
}
