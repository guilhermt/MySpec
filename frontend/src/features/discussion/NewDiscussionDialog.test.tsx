import { screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Add the login screen");
  });

  it("leaves the title to the user when several cards are picked", () => {
    open(["dev/web#12", "dev/web#13"]);

    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Start discussion" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("asks for something to discuss when nothing was picked and nothing was written", async () => {
    const { user } = open([]);

    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(
      screen.getByText("Write what to discuss or select at least one card."),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Title"), "Billing");

    expect(screen.getByRole("button", { name: "Start discussion" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByText("Write what to discuss or select at least one card."),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^What to discuss/), "The invoices are late");

    expect(screen.getByRole("button", { name: "Start discussion" })).toBeEnabled();
  });

  it("closes over a board the app no longer has", async () => {
    const { user } = renderWithStore(<NewDiscussionDialog />, {
      state: makeState({ boards: [] }),
      ui: { newDiscussion: { boardId: "board-1", cardKeys: [], askBoard: false } },
    });

    expect(screen.getAllByText("This board is no longer in the app.")).toHaveLength(2);

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

    expect(screen.getAllByText("Use at most 120 characters.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Start discussion" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("writes the repository of a card short", () => {
    open(["dev/web#12"]);

    expect(screen.getByText("web", { selector: "span" })).toBeInTheDocument();
  });

  it("writes the repository of a card with its owner when another repository has the name", () => {
    renderWithStore(<NewDiscussionDialog />, {
      state: makeState({
        repositories: [makeRepository(), makeRepository({ id: "repo-2", fullName: "other/web" })],
        boards: [makeBoard({ cards: [LOGIN], repositoryIds: ["repo-1", "repo-2"] })],
      }),
      ui: { newDiscussion: { boardId: "board-1", cardKeys: ["dev/web#12"], askBoard: false } },
    });

    expect(screen.getByText("dev/web", { selector: "span" })).toBeInTheDocument();
  });

  it("keeps the short name when the repository with the same name is not on the board", () => {
    renderWithStore(<NewDiscussionDialog />, {
      state: makeState({
        repositories: [makeRepository(), makeRepository({ id: "repo-2", fullName: "other/web" })],
        boards: [makeBoard({ cards: [LOGIN], repositoryIds: ["repo-1"] })],
      }),
      ui: { newDiscussion: { boardId: "board-1", cardKeys: ["dev/web#12"], askBoard: false } },
    });

    expect(screen.getByText("web", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText("dev/web", { selector: "span" })).not.toBeInTheDocument();
  });

  it("drops a card the user takes out of the discussion", async () => {
    const { user } = open(["dev/web#12", "dev/web#13"]);

    await user.click(screen.getByRole("button", { name: "Remove #13 from the discussion" }));

    expect(screen.queryByText("Reset the password")).not.toBeInTheDocument();
    expect(screen.getByText("Add the login screen", { selector: "span" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove #12 from the discussion" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("or pick cards on the board")).toBeInTheDocument();
  });

  it("ignores a card that is no longer in the last reading of the board", () => {
    open(["dev/web#12", "dev/web#99"]);

    expect(screen.getByText("Add the login screen", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Add the login screen");
  });

  it("offers the clone of a repository of the board that has none", async () => {
    const { user } = open(["dev/web#12"], [makeRepository({ cloned: false })]);

    expect(screen.getByText("dev/web isn't cloned.")).toBeInTheDocument();
    expect(
      screen.getByText("The conversation reads the code of the cloned repositories only."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clone" }));

    expect(api.cloneRepository).toHaveBeenCalledWith("repo-1");
  });

  it("asks for the path of a repository of the board whose clone is gone", async () => {
    const { user } = open(["dev/web#12"], [makeRepository({ missing: true })]);

    expect(
      screen.getByText("The clone of dev/web at /home/dev/projects/web is missing."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change path…" }));

    expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
  });

  it("starts the discussion from the text with Ctrl+Enter", async () => {
    const { user } = open(["dev/web#12"]);

    await user.click(screen.getByLabelText(/^What to discuss/));
    await user.keyboard("Break it into cards{Control>}{Enter}{/Control}");

    await waitFor(() => {
      expect(api.startDiscussion).toHaveBeenCalledOnce();
    });
  });

  it("starts the discussion and opens it", async () => {
    const { user } = open(["dev/web#12"]);

    await user.type(screen.getByLabelText(/^What to discuss/), "Break it into cards");
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
    expect(screen.getByRole("button", { name: "Start discussion" })).toBeEnabled();
  });

  it("says the discussion was undone when the conversation did not start", async () => {
    vi.mocked(api.startDiscussion).mockRejectedValueOnce(
      new Error("Claude Code isn't logged in. The discussion was undone."),
    );
    const { user } = open(["dev/web#12"]);

    await user.click(screen.getByRole("button", { name: "Start discussion" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Claude Code isn't logged in. The discussion was undone.",
    );
  });

  it("gives the reasons in the order of the material", async () => {
    const { user } = open([]);
    const start = screen.getByRole("button", { name: "Start discussion" });

    expect(start).toHaveAccessibleDescription("Write what to discuss or select at least one card.");

    await user.type(screen.getByLabelText(/^What to discuss/), "Billing");
    expect(start).toHaveAccessibleDescription("Name the discussion to start it.");

    await user.click(screen.getByLabelText("Title"));
    await user.paste("a".repeat(121));
    expect(start).toHaveAccessibleDescription("Use at most 120 characters.");

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Billing");
    expect(start).toBeEnabled();
  });

  it("counts the title from 100 and does not cut it above 120", async () => {
    const { user } = open([]);
    const title = screen.getByLabelText("Title");

    await user.click(title);
    await user.paste("a".repeat(104));
    expect(screen.getByText("104 of 120")).toBeInTheDocument();

    await user.paste("a".repeat(20));
    expect(title).toHaveValue("a".repeat(124));
    expect(title).toBeInvalid();
    expect(
      screen.getByText("Use at most 120 characters.", { selector: "span" }),
    ).toBeInTheDocument();
  });

  describe("the line of the context", () => {
    it("says where the context comes from, with the characters, and shows it", async () => {
      const { user } = open(["dev/web#12", "dev/web#13"]);

      expect(
        await screen.findByText(/^From the cards: #12 and #13 · \d+ characters$/),
      ).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "The context of the discussion" })).toBeNull();

      const show = screen.getByRole("button", { name: "Show" });
      expect(show).toHaveAttribute("aria-expanded", "false");
      await user.click(show);

      const box = screen.getByLabelText("The context of the discussion");
      expect(within(box).getByTestId("markdown")).toHaveTextContent("## Board");
      expect(screen.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");

      await user.click(screen.getByRole("button", { name: "Hide" }));
      expect(screen.queryByRole("region", { name: "The context of the discussion" })).toBeNull();
    });

    it("is there without cards", async () => {
      open([]);

      expect(
        await screen.findByText(/^From the board and your text · \d+ characters$/),
      ).toBeInTheDocument();
    });

    it("reads the stale cards again, and says so", async () => {
      const stale = makeBoardCard({
        readAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      });
      vi.mocked(api.refreshCard).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 50)),
      );
      renderWithStore(<NewDiscussionDialog />, {
        state: makeState({
          repositories: [makeRepository()],
          boards: [makeBoard({ cards: [stale], repositoryIds: ["repo-1"] })],
        }),
        ui: { newDiscussion: { boardId: "board-1", cardKeys: ["dev/web#12"], askBoard: false } },
      });

      expect(await screen.findByRole("status")).toHaveTextContent("Refreshing the cards…");
      expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute("aria-disabled", "true");

      await waitFor(() => {
        expect(screen.queryByText("Refreshing the cards…")).not.toBeInTheDocument();
      });
      expect(api.refreshCard).toHaveBeenCalledWith("board-1", "dev/web#12");
    });

    it("says the last reading is used when a card could not be read again", async () => {
      vi.mocked(api.refreshCard).mockRejectedValueOnce(new Error("GitHub rate limit reached."));
      const stale = makeBoardCard({
        readAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      });
      renderWithStore(<NewDiscussionDialog />, {
        state: makeState({
          repositories: [makeRepository()],
          boards: [makeBoard({ cards: [stale], repositoryIds: ["repo-1"] })],
        }),
        ui: { newDiscussion: { boardId: "board-1", cardKeys: ["dev/web#12"], askBoard: false } },
      });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't refresh the cards: GitHub rate limit reached. The discussion will use the last reading.",
      );
      expect(screen.getByText(/^From the card: #12/)).toBeInTheDocument();
    });
  });

  it("starts with Starting…, with the fields read-only and Esc, × and Cancel inert", async () => {
    let finish: (id: string) => void = () => {};
    vi.mocked(api.startDiscussion).mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = open(["dev/web#12"]);

    await user.click(screen.getByRole("button", { name: "Start discussion" }));

    expect(await screen.findByRole("button", { name: "Starting…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByText("Starting the conversation…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Title")).toHaveAttribute("readonly");
    const model = screen.getByRole("button", { name: /^Discussion model:/ });
    expect(model.closest("[inert]")).not.toBeNull();
    await user.click(model);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(useAppStore.getState().newDiscussion).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(useAppStore.getState().newDiscussion).not.toBeNull();

    finish("discussion-1");
    await waitFor(() => {
      expect(useAppStore.getState().newDiscussion).toBeNull();
    });
  });

  it("leaves Cancel only when the board leaves with the dialog open", async () => {
    open(["dev/web#12"]);
    expect(screen.getByLabelText("Title")).toBeInTheDocument();

    useAppStore.setState((state) => ({ app: state.app && { ...state.app, boards: [] } }));

    expect(await screen.findAllByText("This board is no longer in the app.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Start discussion" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
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

    it("starts on the board last used and takes the focus", async () => {
      const { user } = ask();

      const field = screen.getByRole("button", { name: "Board: Beta" });
      await waitFor(() => expect(field).toHaveFocus());
      expect(
        screen.getByText(
          "The discussion reads the clones of the board's repositories and publishes its cards there.",
        ),
      ).toBeInTheDocument();

      await user.click(field);
      expect(await screen.findByRole("menuitemradio", { name: /Beta/ })).toHaveTextContent(
        "last used",
      );
      expect(screen.getByRole("menuitemradio", { name: /Alpha/ })).not.toHaveTextContent(
        "last used",
      );
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
      await user.type(screen.getByLabelText(/^What to discuss/), "The invoices are late");

      await user.click(screen.getByRole("button", { name: "Board: Beta" }));
      await user.click(await screen.findByRole("menuitemradio", { name: /Alpha/ }));

      expect(screen.getByRole("button", { name: "Board: Alpha" })).toBeInTheDocument();
      expect(screen.getByLabelText("Title")).toHaveValue("Billing");
      expect(screen.getByLabelText(/^What to discuss/)).toHaveValue("The invoices are late");
    });
  });
});
