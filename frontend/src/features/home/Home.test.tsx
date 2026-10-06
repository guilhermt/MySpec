import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Home } from "@/features/home/Home";
import { HOME } from "@/lib/locations";
import { api, type Situation } from "@/lib/wails";
import { stepTabKey, useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeDiscussion,
  makeRepository,
  makeReviewCenter,
  makeSituation,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const TASK = { kind: "task", id: "task-1" } as const;

function withTask(situations: Situation[]) {
  return makeState({
    boards: [makeBoard()],
    repositories: [makeRepository({ boardId: "board-1" })],
    tasks: [makeTask({ id: "task-1", name: "add-login", situations })],
  });
}

describe("Home", () => {
  describe("Continue", () => {
    it("opens the item where its most serious situation is, with Enter", async () => {
      const waiting = makeSituation({
        id: "wait",
        taskId: "task-1",
        group: "waiting",
        place: { kind: "step", stage: "", step: 5 },
      });
      const error = makeSituation({
        id: "error",
        taskId: "task-1",
        group: "error",
        place: { kind: "step_review", stage: "", step: 3 },
      });
      const { user } = renderWithStore(<Home />, {
        state: withTask([waiting, error]),
        ui: { location: HOME, back: [TASK] },
      });

      await user.keyboard("{Enter}");

      expect(useAppStore.getState().location).toEqual(TASK);
      expect(useAppStore.getState().openStepTab).toEqual({
        [stepTabKey("task-1", 3)]: "reviewer",
      });
    });

    it("opens the item itself without a situation", async () => {
      const { user } = renderWithStore(<Home />, {
        state: withTask([]),
        ui: { location: HOME, back: [TASK] },
      });

      await user.click(screen.getByRole("button", { name: /^Continue: / }));

      expect(useAppStore.getState().location).toEqual(TASK);
    });

    it("goes back to the earlier item when the last one is gone", () => {
      renderWithStore(<Home />, {
        state: makeState({
          repositories: [makeRepository()],
          tasks: [makeTask({ id: "task-1", name: "add-login" })],
        }),
        ui: { location: HOME, back: [TASK, { kind: "task", id: "gone" }] },
      });

      expect(screen.getByRole("button", { name: /^Continue: .*add-login/ })).toBeInTheDocument();
    });

    it("says nothing is in progress without an active item", () => {
      renderWithStore(<Home />, { state: makeState() });

      expect(screen.getByText("Nothing in progress")).toBeInTheDocument();
      expect(
        screen.getByText(
          "No task, review or discussion is active. Start one from a card, a pull request or a board.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("focus", () => {
    it("starts on Continue", () => {
      renderWithStore(<Home />, { state: withTask([]), ui: { location: HOME, back: [TASK] } });

      expect(screen.getByRole("button", { name: /^Continue: / })).toHaveFocus();
    });

    it("starts on the first row of Start without Continue", () => {
      renderWithStore(<Home />, { state: makeState() });

      expect(screen.getByRole("button", { name: "New task" })).toHaveFocus();
    });
  });

  describe("Start", () => {
    it("says what New task and New discussion lead to", () => {
      renderWithStore(<Home />, { state: makeState({ boards: [makeBoard()] }) });

      expect(screen.getByRole("button", { name: "New task" })).toHaveAccessibleDescription(
        "From scratch. A card starts its task on its board.",
      );
      expect(screen.getByRole("button", { name: "New discussion" })).toHaveAccessibleDescription(
        "About the demand of one board",
      );
    });

    it("opens the creation dialog from New task", async () => {
      const { user } = renderWithStore(<Home />, { state: makeState() });

      await user.click(screen.getByRole("button", { name: "New task" }));

      expect(useAppStore.getState().newTaskOpen).toBe(true);
    });

    it("goes to Reviews, saying what is pending", async () => {
      const { user } = renderWithStore(<Home />, {
        state: makeState({ reviewCenter: makeReviewCenter({ readAt: "2026-09-16T12:00:00Z" }) }),
      });

      expect(screen.getByText("Nothing pending")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Review a pull request" }));

      expect(useAppStore.getState().location).toEqual({ kind: "reviews" });
    });

    it("opens a discussion of the only board without asking", async () => {
      const { user } = renderWithStore(<Home />, { state: makeState({ boards: [makeBoard()] }) });

      await user.click(screen.getByRole("button", { name: "New discussion" }));

      expect(useAppStore.getState().newDiscussion).toEqual({
        boardId: "board-1",
        cardKeys: [],
        askBoard: false,
      });
    });

    it("asks the board with several", async () => {
      const { user } = renderWithStore(<Home />, {
        state: makeState({
          boards: [makeBoard({ id: "a" }), makeBoard({ id: "b" })],
          discussions: [makeDiscussion({ boardId: "b" })],
        }),
      });

      await user.click(screen.getByRole("button", { name: "New discussion" }));

      expect(useAppStore.getState().newDiscussion).toEqual({
        boardId: "b",
        cardKeys: [],
        askBoard: true,
      });
    });

    it("dashes New discussion without a board, with the reason", async () => {
      const { user } = renderWithStore(<Home />, { state: makeState({ boards: [] }) });

      const row = screen.getByRole("button", { name: "New discussion" });
      expect(row).toHaveAttribute("aria-disabled", "true");
      expect(row).toHaveAccessibleDescription("Add a board to discuss its cards.");
      await user.click(row);
      expect(useAppStore.getState().newDiscussion).toBeNull();
    });
  });

  describe("Boards", () => {
    it("opens a board, and stays on Home while there is no task", async () => {
      const { user } = renderWithStore(<Home />, {
        state: makeState({ boards: [makeBoard()], repositories: [makeRepository()] }),
      });

      expect(useAppStore.getState().location).toEqual(HOME);
      await user.click(screen.getByRole("button", { name: /^Roadmap, / }));

      expect(useAppStore.getState().location).toEqual({ kind: "board", id: "board-1" });
    });

    it("reads a board again after its failure", async () => {
      const { user } = renderWithStore(<Home />, {
        state: makeState({
          boards: [
            makeBoard({
              failure: {
                reason: "gh",
                message: "GitHub didn't answer.",
                failedAt: "2026-09-16T12:00:00Z",
              },
            }),
          ],
          repositories: [makeRepository()],
        }),
      });

      expect(screen.getByText("GitHub didn't answer.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Try again" }));

      expect(api.refreshBoard).toHaveBeenCalledWith("board-1");
    });

    it("clones a repository of a board and says why the clone failed", async () => {
      vi.mocked(api.cloneRepository).mockRejectedValueOnce(new Error("gh: no access"));
      const { user } = renderWithStore(<Home />, {
        state: makeState({
          boards: [makeBoard()],
          repositories: [makeRepository({ cloned: false, boardId: "board-1" })],
        }),
      });

      await user.click(screen.getByRole("button", { name: "Clone" }));

      expect(api.cloneRepository).toHaveBeenCalledWith("repo-1");
      expect(await screen.findByText("gh: no access")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });

    it("asks for the path of a clone that is missing, and shows the refusal", async () => {
      vi.mocked(api.changeRepositoryPath).mockRejectedValueOnce(
        new Error("Not a clone of dev/web."),
      );
      const { user } = renderWithStore(<Home />, {
        state: makeState({
          boards: [makeBoard()],
          repositories: [makeRepository({ missing: true, boardId: "board-1" })],
        }),
      });

      await user.click(screen.getByRole("button", { name: "Change path…" }));

      expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
      expect(await screen.findByRole("alert")).toHaveTextContent("Not a clone of dev/web.");
    });

    it("lists the repositories without a board", () => {
      renderWithStore(<Home />, {
        state: makeState({
          boards: [makeBoard()],
          repositories: [makeRepository({ id: "loose", name: "loose", fullName: "dev/loose" })],
        }),
      });

      const group = screen.getByRole("group", { name: "Repositories without a board" });
      expect(within(group).getByText("No board")).toBeInTheDocument();
      expect(within(group).getByText("loose")).toBeInTheDocument();
    });
  });

  it("lists the shortcuts", () => {
    renderWithStore(<Home />, { state: makeState() });

    const shortcuts = screen.getByRole("group", { name: "Shortcuts" });
    for (const text of ["Next that needs you", "New task", "Back", "Settings"]) {
      expect(within(shortcuts).getByText(text)).toBeInTheDocument();
    }
  });
});
