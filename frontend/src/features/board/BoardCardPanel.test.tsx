import { act, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardCardPanel } from "@/features/board/BoardCardPanel";
import { BoardView } from "@/features/board/BoardView";
import { useStartCard } from "@/features/board/useStartCard";
import { api, type Board, type BoardCard, type Repository } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeBoardCard,
  makeBoardRepositoryOption,
  makeRepository,
  makeState,
} from "@/test/wails-mock";

const NOW = Date.parse("2026-09-16T13:00:00Z");
const BOARD = makeBoard();

interface HarnessProps {
  card: BoardCard;
  /** others are the other cards of the reading. */
  others?: BoardCard[];
  outOfReading?: boolean;
  onOpenCard?: (key: string) => void;
  onDiscuss?: () => void;
}

let setCard: (card: BoardCard) => void = () => undefined;

function Harness({
  card: initial,
  others = [],
  outOfReading = false,
  onOpenCard,
  onDiscuss,
}: HarnessProps) {
  const [card, update] = useState(initial);
  setCard = update;
  const start = useStartCard(BOARD, card);
  return (
    <BoardCardPanel
      key={card.key}
      board={{ ...BOARD, cards: [card, ...others] }}
      card={card}
      outOfReading={outOfReading}
      start={start}
      now={NOW}
      onClose={vi.fn()}
      onOpenCard={onOpenCard ?? vi.fn()}
      onDiscuss={onDiscuss ?? vi.fn()}
    />
  );
}

function panel(card: BoardCard, repository: Partial<Repository> = {}, props = {}) {
  return renderWithStore(<Harness card={card} {...props} />, {
    state: {
      ...makeState({ boards: [BOARD] }),
      repositories: [makeRepository({ boardId: BOARD.id, ...repository })],
    },
  });
}

const uncloned = { cloned: false, path: "" };

afterEach(() => {
  setCard = () => undefined;
});

describe("BoardCardPanel", () => {
  it("names the panel by its card and draws its title, status, fields and description", () => {
    panel(
      makeBoardCard({
        status: "In progress",
        state: "closed",
        fields: [{ name: "Priority", value: "P1" }],
        assignees: [{ login: "ana", avatarUrl: "" }],
      }),
    );

    expect(screen.getByRole("complementary", { name: "Card #12" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add the login screen" })).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText(/· Closed/)).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Assignees")).toBeInTheDocument();
    expect(screen.getByText("Email and password.")).toBeInTheDocument();
  });

  it("says No description for a card without a body", () => {
    panel(makeBoardCard({ body: "" }));

    expect(screen.getByText("No description.")).toBeInTheDocument();
  });

  describe("the actions of each case", () => {
    it.each([
      ["start", makeBoardCard(), {}, "Start task", true],
      ["clone", makeBoardCard({ action: "clone" }), uncloned, "Clone and continue", true],
      [
        "clone running",
        makeBoardCard({ action: "clone" }),
        { ...uncloned, cloning: true },
        "Cloning dev/web…",
        true,
      ],
      [
        "clone failed",
        makeBoardCard({ action: "clone" }),
        { ...uncloned, cloneError: "remote hung up" },
        "Try the clone again",
        true,
      ],
      [
        "clone missing",
        makeBoardCard({ action: "clone_missing" }),
        { missing: true },
        "Start task",
        true,
      ],
      ["add to board", makeBoardCard({ action: "add_to_board" }), {}, "Start task", true],
      [
        "other board",
        makeBoardCard({ action: "other_board", otherBoard: "Platform" }),
        {},
        "Start task",
        true,
      ],
      ["has task", makeBoardCard({ action: "has_task" }), {}, null, false],
      ["closed", makeBoardCard({ action: "closed" }), {}, null, false],
    ] as const)("has at most one primary for %s", (_name, card, repository, label, hasPrimary) => {
      const { container } = panel(card, repository);

      const primaries = container.ownerDocument.querySelectorAll("[data-primary]");
      expect(primaries).toHaveLength(hasPrimary ? 1 : 0);
      if (label !== null) {
        expect(primaries[0]).toHaveAccessibleName(new RegExp(`^${label}`));
      }
    });

    it("opens the creation dialog for the card from Start task", async () => {
      const { user } = panel(makeBoardCard());

      await user.click(screen.getByRole("button", { name: /^Start task/ }));

      expect(useAppStore.getState().newTaskCard).toEqual({ boardId: "board-1", key: "dev/web#12" });
    });

    it("clones, then waits for the clone to open the dialog", async () => {
      const { user } = panel(makeBoardCard({ action: "clone" }), uncloned);

      expect(
        screen.getByText("dev/web isn't cloned yet. A task needs a clone."),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /^Clone and continue/ }));

      expect(api.cloneRepository).toHaveBeenCalledWith("repo-1");
      expect(useAppStore.getState().pendingStart).toEqual({
        boardId: "board-1",
        key: "dev/web#12",
        repositoryId: "repo-1",
      });
    });

    it("shows the clone running as a busy button, and the message of a failed one", () => {
      panel(makeBoardCard({ action: "clone" }), { ...uncloned, cloning: true });
      expect(screen.getByRole("button", { name: "Cloning dev/web…" })).toHaveAttribute(
        "aria-busy",
        "true",
      );
      expect(screen.getByText("The clone is running.")).toBeInTheDocument();
    });

    it("promises the dialog only for the card that asked for the clone", () => {
      const card = makeBoardCard({ action: "clone" });
      renderWithStore(<Harness card={card} />, {
        state: {
          ...makeState({ boards: [BOARD] }),
          repositories: [makeRepository({ boardId: BOARD.id, ...uncloned, cloning: true })],
        },
        ui: { pendingStart: { boardId: BOARD.id, key: card.key, repositoryId: "repo-1" } },
      });

      expect(
        screen.getByText(
          "The dialog opens when the clone ends. You can leave the board meanwhile.",
        ),
      ).toBeInTheDocument();
    });

    it("shows the message of the clone that failed, in the error tone", () => {
      panel(makeBoardCard({ action: "clone" }), { ...uncloned, cloneError: "remote hung up" });

      expect(screen.getByRole("alert")).toHaveTextContent("remote hung up");
    });

    it("dashes Start task for a missing clone and Discuss for a card outside the board", () => {
      panel(makeBoardCard({ action: "other_board", otherBoard: "Platform" }));

      expect(screen.getByRole("button", { name: /^Start task/ })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(screen.getByRole("button", { name: "Discuss" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(screen.getByText("dev/web belongs to the board Platform.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Discuss" })).toHaveAccessibleDescription(
        "dev/web isn't a repository of this board.",
      );
    });

    it("discusses the card from Discuss", async () => {
      const onDiscuss = vi.fn();
      const { user } = panel(makeBoardCard(), {}, { onDiscuss });

      await user.click(screen.getByRole("button", { name: /^Discuss/ }));

      expect(onDiscuss).toHaveBeenCalledOnce();
    });
  });

  describe("Change path…", () => {
    it("shows a refusal under the reason", async () => {
      vi.mocked(api.changeRepositoryPath).mockRejectedValueOnce(
        new Error("That isn't a clone of dev/web."),
      );
      const { user } = panel(makeBoardCard({ action: "clone_missing" }), { missing: true });

      await user.click(screen.getByRole("button", { name: "Change path…" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("That isn't a clone of dev/web.");
    });

    it("takes the focus to Start task once the card can start", async () => {
      const { user } = panel(makeBoardCard({ action: "clone_missing" }), { missing: true });

      await user.click(screen.getByRole("button", { name: "Change path…" }));
      expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
      act(() => setCard(makeBoardCard({ action: "start" })));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /^Start task/ })).toHaveFocus(),
      );
    });
  });

  describe("Change path… and the card it was for", () => {
    it("does not show its refusal on another card", async () => {
      vi.mocked(api.changeRepositoryPath).mockRejectedValueOnce(
        new Error("That isn't a clone of dev/web."),
      );
      const { user } = panel(makeBoardCard({ action: "clone_missing" }), { missing: true });
      await user.click(screen.getByRole("button", { name: "Change path…" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();

      act(() => setCard(makeBoardCard({ key: "dev/web#13", number: 13, action: "clone_missing" })));

      expect(screen.getByRole("complementary", { name: "Card #13" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not take the focus to the card later after a picker that was cancelled", async () => {
      vi.mocked(api.changeRepositoryPath).mockResolvedValueOnce(false);
      const { user } = panel(makeBoardCard({ action: "clone_missing" }), { missing: true });
      await user.click(screen.getByRole("button", { name: "Change path…" }));
      await waitFor(() => expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1"));

      act(() => setCard(makeBoardCard({ action: "start" })));

      expect(screen.getByRole("button", { name: /^Start task/ })).not.toHaveFocus();
    });

    it("does not take the focus to another card after a picker that was cancelled", async () => {
      vi.mocked(api.changeRepositoryPath).mockResolvedValueOnce(false);
      const { user } = panel(makeBoardCard({ action: "clone_missing" }), { missing: true });
      await user.click(screen.getByRole("button", { name: "Change path…" }));
      expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");

      act(() => setCard(makeBoardCard({ key: "dev/web#13", number: 13, action: "start" })));

      expect(screen.getByRole("button", { name: /^Start task/ })).not.toHaveFocus();
    });
  });

  describe("Add to board", () => {
    it("asks in the dialog, adds, and takes the focus to the primary the card gets", async () => {
      vi.mocked(api.checkBoardRepository).mockResolvedValue(
        makeBoardRepositoryOption({ link: "clone", path: "/home/dev/web", checked: false }),
      );
      const { user } = panel(makeBoardCard({ action: "add_to_board", repositoryId: "" }));

      expect(
        screen.getByText("dev/web isn't managed by this board. Start task adds it first."),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /^Start task/ }));
      const dialog = await screen.findByRole("dialog", { name: "Add dev/web to the board" });
      await within(dialog).findByText("dev/web");
      await user.click(within(dialog).getByRole("button", { name: "Add to board" }));
      expect(api.addRepositoryToBoard).toHaveBeenCalled();
      act(() => setCard(makeBoardCard({ action: "start" })));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /^Start task/ })).toHaveFocus(),
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("takes the focus to Clone and continue when the card gets a clone to make", async () => {
      vi.mocked(api.checkBoardRepository).mockResolvedValue(
        makeBoardRepositoryOption({ link: "clone", path: "/home/dev/web", checked: false }),
      );
      const { user } = panel(makeBoardCard({ action: "add_to_board", repositoryId: "" }));

      await user.click(screen.getByRole("button", { name: /^Start task/ }));
      const dialog = await screen.findByRole("dialog", { name: "Add dev/web to the board" });
      await within(dialog).findByText("dev/web");
      await user.click(within(dialog).getByRole("button", { name: "Add to board" }));
      act(() => setCard(makeBoardCard({ action: "clone" })));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /^Clone and continue/ })).toHaveFocus(),
      );
    });

    it("shows the refusal in the dialog and stays open", async () => {
      vi.mocked(api.checkBoardRepository).mockResolvedValue(
        makeBoardRepositoryOption({ link: "clone", path: "/home/dev/web", checked: false }),
      );
      vi.mocked(api.addRepositoryToBoard).mockRejectedValueOnce(new Error("The board refused it."));
      const { user } = panel(makeBoardCard({ action: "add_to_board", repositoryId: "" }));

      await user.click(screen.getByRole("button", { name: /^Start task/ }));
      const dialog = await screen.findByRole("dialog");
      await within(dialog).findByText("dev/web");
      await user.click(within(dialog).getByRole("button", { name: "Add to board" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("The board refused it.");
    });
  });

  describe("a card out of the reading", () => {
    it("says so in a strip and dashes the actions with it as their reason", () => {
      panel(makeBoardCard(), {}, { outOfReading: true });

      const strip = screen.getByRole("status");
      expect(strip).toHaveTextContent("This card isn't in the last reading of the board.");
      expect(strip).toHaveTextContent("so a task or a discussion can't start from it.");
      for (const name of [/^Start task/, /^Discuss/]) {
        const button = screen.getByRole("button", { name });
        expect(button).toHaveAttribute("aria-disabled", "true");
        expect(button).toHaveAttribute("aria-describedby", strip.id);
      }
    });
  });

  it("opens a relation that is a card of the reading in the panel, and the others on GitHub", async () => {
    const onOpenCard = vi.fn();
    const card = makeBoardCard({
      siblings: [
        {
          key: "dev/web#13",
          repository: "dev/web",
          number: 13,
          title: "Reset the password",
          url: "https://github.com/dev/web/issues/13",
          state: "open",
          status: "Todo",
          onBoard: true,
        },
      ],
      pullRequests: [
        {
          repository: "dev/web",
          number: 21,
          url: "https://github.com/dev/web/pull/21",
          state: "open",
        },
      ],
    });
    const { user } = renderWithStore(
      <Harness
        card={card}
        others={[makeBoardCard({ key: "dev/web#13", number: 13 })]}
        onOpenCard={onOpenCard}
      />,
      {
        state: makeState({ boards: [BOARD] }),
      },
    );

    await user.click(screen.getByRole("link", { name: "#13 Reset the password" }));
    expect(onOpenCard).toHaveBeenCalledWith("dev/web#13");
    await user.click(screen.getByRole("link", { name: /^#21/ }));
    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/21");
  });

  it("opens the task, and the discussions the card is in and came from", async () => {
    const card = makeBoardCard({
      archivedTaskId: "task-old",
      archivedTaskName: "Login screen",
      writtenBy: { id: "d-1", title: "Pricing", archived: true },
    });
    const { user } = renderWithStore(<Harness card={card} />, {
      state: makeState({
        boards: [BOARD],
      }),
    });

    await user.click(await screen.findByRole("link", { name: "Archived task: Login screen" }));
    expect(useAppStore.getState().location).toEqual({ kind: "archived-task", id: "task-old" });
    await user.click(screen.getByRole("link", { name: "From the discussion Pricing" }));
    expect(useAppStore.getState().location).toEqual({ kind: "archived-discussion", id: "d-1" });
  });
});

const LOGIN = makeBoardCard();
const HEADER = makeBoardCard({
  key: "dev/web#7",
  number: 7,
  title: "Fix the header",
  statusId: "in-progress",
  status: "In progress",
});

function screenOf(board: Partial<Board> = {}) {
  return renderWithStore(<BoardView boardId="board-1" />, {
    state: makeState({
      repositories: [makeRepository({ boardId: "board-1" })],
      boards: [makeBoard({ cards: [LOGIN, HEADER], ...board })],
    }),
    ui: { location: { kind: "board", id: "board-1" } },
  });
}

describe("BoardCardPanel in the board", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("keeps a card its reading dropped in the panel, out of the reading, with its row gone", async () => {
    const { user } = screenOf();
    await user.click(screen.getByRole("treeitem", { name: /#12/ }));

    act(() => {
      useAppStore.getState().applyState(
        makeState({
          repositories: [makeRepository({ boardId: "board-1" })],
          boards: [makeBoard({ cards: [HEADER] })],
        }),
      );
    });

    expect(screen.queryByRole("treeitem", { name: /#12/ })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Card #12" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "This card isn't in the last reading of the board.",
    );
  });

  it("takes a card its reading dropped out of the selection", async () => {
    const { user } = screenOf();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: /Select/ }));
    await user.click(screen.getByRole("treeitem", { name: /#12/ }));
    await user.click(screen.getByRole("treeitem", { name: /#7/ }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    act(() => {
      useAppStore.getState().applyState(
        makeState({
          repositories: [makeRepository({ boardId: "board-1" })],
          boards: [makeBoard({ cards: [HEADER] })],
        }),
      );
    });

    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("opens another card of the board from a relation, with its row focused", async () => {
    const linked = makeBoardCard({
      siblings: [
        {
          key: "dev/web#7",
          repository: "dev/web",
          number: 7,
          title: "Fix the header",
          url: "u",
          state: "open",
          status: "In progress",
          onBoard: true,
        },
      ],
    });
    const { user } = screenOf({ cards: [linked, HEADER] });
    await user.click(screen.getByRole("treeitem", { name: /#12/ }));

    await user.click(within(screen.getByRole("complementary")).getByRole("link", { name: /#7/ }));

    expect(screen.getByRole("complementary", { name: "Card #7" })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /#7/ })).toHaveFocus();
  });
});
