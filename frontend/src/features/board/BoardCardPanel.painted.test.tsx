import { describe, expect, it, vi } from "vitest";
import { BoardCardPanel } from "@/features/board/BoardCardPanel";
import { useStartCard } from "@/features/board/useStartCard";
import type { BoardCard } from "@/lib/wails";
import { HEADED, setTheme, THEMES, uiHeadings } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeBoardCard, makeRepository, makeState } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

const BOARD = makeBoard();

function Harness({ card }: { card: BoardCard }) {
  const start = useStartCard(BOARD, card);
  return (
    <BoardCardPanel
      board={{ ...BOARD, cards: [card] }}
      card={card}
      outOfReading={false}
      start={start}
      now={Date.parse("2026-09-16T13:00:00Z")}
      onClose={() => undefined}
      onOpenCard={() => undefined}
      onDiscuss={() => undefined}
    />
  );
}

describe.each(THEMES)("BoardCardPanel in the %s theme", (theme) => {
  it("draws the headings of the description at the size of the UI, in 600", async () => {
    setTheme(theme);
    renderWithStore(<Harness card={makeBoardCard({ body: HEADED })} />, {
      state: {
        ...makeState({ boards: [BOARD] }),
        repositories: [makeRepository({ boardId: BOARD.id })],
      },
    });

    const { got, want } = await uiHeadings();
    expect(got).toEqual(want);
  });
});
