import { findBoard } from "@/lib/boards";
import type { PullCard } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/**
 * useOpenCard opens the card a pull request is linked to: in the board, in its panel, when the last
 * reading of the board has it; on GitHub otherwise.
 */
export function useOpenCard(): (card: PullCard) => void {
  const app = useAppStore((state) => state.app);
  const openBoardCard = useAppStore((state) => state.openBoardCard);
  return (card) => {
    const found = (findBoard(app, card.boardId)?.cards ?? []).find(
      (candidate) => candidate.url === card.url,
    );
    if (found === undefined) {
      void openExternal(card.url);
    } else {
      openBoardCard(card.boardId, found.key);
    }
  };
}
