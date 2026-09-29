import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewDiscussionDialog } from "@/features/discussion/NewDiscussionDialog";
import { api, type Repository } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeRepository,
  makeState,
} from "@/test/wails-mock";

const LOGIN = makeBoardCard();
const RESET = makeBoardCard({ key: "dev/web#13", number: 13, title: "Reset the password" });

function open(cardKeys: string[], repositories: Repository[] = [makeRepository()]) {
  return renderWithStore(<NewDiscussionDialog />, {
    state: makeState({
      repositories,
      boards: [makeBoard({ cards: [LOGIN, RESET], repositoryIds: ["repo-1"] })],
    }),
    ui: { newDiscussion: { boardId: "board-1", cardKeys, askBoard: false } },
  });
}

describe("NewDiscussionDialog", () => {
  it("stays closed until something asks for it", () => {
    renderWithStore(<NewDiscussionDialog />, { state: makeState() });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("suggests the title of the one card picked, and names the board", () => {
    open(["dev/web#12"]);

    expect(screen.getByRole("heading", { name: "New discussion" })).toBeInTheDocument();
    expect(screen.getByText("Roadmap")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Add the login screen");
  });

  it("leaves the title to the user when several cards are picked", () => {
    open(["dev/web#12", "dev/web#13"]);

    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Start discussion" })).toBeDisabled();
  });

  it("asks for something to discuss when nothing was picked and nothing was written", async () => {
    const { user } = open([]);

    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(
      screen.getByText("Write what to discuss or select at least one card."),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Title"), "Billing");

    expect(screen.getByRole("button", { name: "Start discussion" })).toBeDisabled();
    expect(
      screen.getByText("Write what to discuss or select at least one card."),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("What to discuss"), "The invoices are late");

    expect(screen.getByRole("button", { name: "Start discussion" })).toBeEnabled();
  });

  it("closes over a board the app no longer has", async () => {
    const { user } = renderWithStore(<NewDiscussionDialog />, {
      state: makeState({ boards: [] }),
      ui: { newDiscussion: { boardId: "board-1", cardKeys: [], askBoard: false } },
    });

    expect(screen.getByText("This board is no longer in the app.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(useAppStore.getState().newDiscussion).toBeNull();
  });

  it("says a suggested title does not fit", () => {
    const long = makeBoardCard({ key: "dev/web#20", number: 20, title: "a".repeat(200) });
    renderWithStore(<NewDiscussionDialog />, {
      state: makeState({
        repositories: [makeRepository()],
        boards: [makeBoard({ cards: [long], repositoryIds: ["repo-1"] })],
      }),
      ui: { newDiscussion: { boardId: "board-1", cardKeys: ["dev/web#20"], askBoard: false } },
    });

    expect(screen.getByText("Use at most 120 characters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start discussion" })).toBeDisabled();
  });

  it("drops a card the user takes out of the discussion", async () => {
    const { user } = open(["dev/web#12", "dev/web#13"]);

    await user.click(screen.getByRole("button", { name: "Remove #13" }));

    expect(screen.queryByText(/Reset the password/)).not.toBeInTheDocument();
    expect(screen.getByText(/Add the login screen · dev\/web/)).toBeInTheDocument();
  });

  it("ignores a card that is no longer in the last reading of the board", () => {
    open(["dev/web#12", "dev/web#99"]);

    expect(screen.getByText(/Add the login screen · dev\/web/)).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Add the login screen");
  });

  it("offers the clone of a repository of the board that has none", async () => {
    const { user } = open(["dev/web#12"], [makeRepository({ cloned: false })]);

    expect(
      screen.getByText("The conversation reads the code of the cloned repositories."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clone" }));

    expect(api.cloneRepository).toHaveBeenCalledWith("repo-1");
  });

  it("asks for the path of a repository of the board whose clone is gone", async () => {
    const { user } = open(["dev/web#12"], [makeRepository({ missing: true })]);

    expect(screen.getByText("The clone at /home/dev/projects/web is missing.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change path" }));

    expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
  });

  it("starts the discussion from the text with Ctrl+Enter", async () => {
    const { user } = open(["dev/web#12"]);

    await user.click(screen.getByLabelText("What to discuss"));
    await user.keyboard("Break it into cards{Control>}{Enter}{/Control}");

    await waitFor(() => {
      expect(api.startDiscussion).toHaveBeenCalledOnce();
    });
  });

  it("starts the discussion and opens it", async () => {
    const { user } = open(["dev/web#12"]);

    await user.type(screen.getByLabelText("What to discuss"), "Break it into cards");
    await user.click(screen.getByRole("button", { name: "Start discussion" }));

    await waitFor(() => {
      expect(api.startDiscussion).toHaveBeenCalledWith({
        boardId: "board-1",
        title: "Add the login screen",
        text: "Break it into cards",
        cards: ["dev/web#12"],
        model: "claude-fable-5-1",
        effort: "high",
      });
    });
    expect(useAppStore.getState().location).toEqual({ kind: "discussion", id: "discussion-1" });
    expect(useAppStore.getState().newDiscussion).toBeNull();
  });

  it("keeps the dialog open and shows why the discussion did not start", async () => {
    vi.mocked(api.startDiscussion).mockRejectedValueOnce(new Error("The board is being read."));
    const { user } = open(["dev/web#12"]);

    await user.click(screen.getByRole("button", { name: "Start discussion" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The board is being read.");
    expect(useAppStore.getState().newDiscussion).not.toBeNull();
  });

  describe("the Board field", () => {
    const ALPHA = makeBoard({ id: "alpha", title: "Alpha", repositoryIds: ["repo-1"] });
    const BETA = makeBoard({ id: "beta", title: "Beta", repositoryIds: ["repo-1"] });
    const NEW = makeBoard({ id: "new", title: "New", repositoryIds: ["repo-1"], readAt: "" });

    function ask() {
      return renderWithStore(<NewDiscussionDialog />, {
        state: makeState({
          repositories: [makeRepository()],
          boards: [ALPHA, BETA, NEW],
          discussions: [makeDiscussion({ boardId: "beta", createdAt: "2026-09-20T10:00:00Z" })],
        }),
        ui: { newDiscussion: { boardId: "beta", cardKeys: [], askBoard: true } },
      });
    }

    it("shows only when the dialog asks the board", () => {
      open(["dev/web#12"]);

      expect(screen.queryByRole("button", { name: /^Board:/ })).not.toBeInTheDocument();
    });

    it("starts on the board last used and takes the focus", () => {
      ask();

      const field = screen.getByRole("button", { name: "Board: Beta" });
      expect(field).toHaveFocus();
      expect(
        screen.getByText(
          "The discussion reads the clones of the board's repositories and publishes its cards there.",
        ),
      ).toBeInTheDocument();
    });

    it("disables a board that was never read, with its reason", async () => {
      const { user } = ask();

      await user.click(screen.getByRole("button", { name: "Board: Beta" }));

      const option = await screen.findByRole("menuitemradio", { name: /New/ });
      expect(option).toHaveAttribute("aria-disabled", "true");
      expect(option).toHaveTextContent("not read yet");
    });

    it("keeps what was written when another board is chosen", async () => {
      const { user } = ask();
      await user.type(screen.getByLabelText("Title"), "Billing");
      await user.type(screen.getByLabelText("What to discuss"), "The invoices are late");

      await user.click(screen.getByRole("button", { name: "Board: Beta" }));
      await user.click(await screen.findByRole("menuitemradio", { name: /Alpha/ }));

      expect(screen.getByRole("button", { name: "Board: Alpha" })).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toHaveValue("Billing");
      expect(screen.getByLabelText("What to discuss")).toHaveValue("The invoices are late");
    });
  });
});
