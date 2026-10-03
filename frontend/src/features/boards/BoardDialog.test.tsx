import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardDialog, type BoardDialogProps } from "@/features/boards/BoardDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeBoardPreview,
  makeBoardRepositoryOption,
  makeRepository,
  makeState,
} from "@/test/wails-mock";

const URL = "https://github.com/orgs/dev/projects/3";
const OTHER_URL = "https://github.com/orgs/dev/projects/4";

function dialog(mode: { mode: "add" } | { mode: "edit"; boardId: string } = { mode: "add" }) {
  const onOpenChange = vi.fn();
  const props = { ...mode, open: true, onOpenChange } as BoardDialogProps;
  const rendered = renderWithStore(<BoardDialog {...props} />, {
    state: makeState({
      boards: [makeBoard({ title: "Platform Roadmap" })],
      repositories: [
        makeRepository({ id: "repo-1", fullName: "dev/web", archivedTasks: 3 }),
        makeRepository({ id: "repo-2", name: "docs", fullName: "dev/docs", cloned: false }),
      ],
    }),
  });
  return { ...rendered, onOpenChange };
}

const URL_FIELD = { name: "URL of the GitHub project" };

/** readBoard pastes the URL of the board and reads it. */
async function readBoard(user: ReturnType<typeof dialog>["user"], url = URL) {
  await user.type(screen.getByRole("textbox", URL_FIELD), url);
  await user.click(screen.getByRole("button", { name: /^Continue/ }));
}

const subtitleOf = () => screen.getByRole("dialog").querySelector("p")?.textContent;

describe("BoardDialog, adding", () => {
  it("adds a board through its project, its statuses and its repositories", async () => {
    const { user, onOpenChange } = dialog();

    expect(screen.getByRole("dialog", { name: "Add board" })).toBeInTheDocument();
    expect(subtitleOf()).toBe("Step 1 of 3 · The project");
    await waitFor(() => expect(screen.getByRole("textbox", URL_FIELD)).toHaveFocus());

    await readBoard(user);

    expect(api.previewBoard).toHaveBeenCalledWith(URL);
    expect(await screen.findByText("Roadmap · dev · Step 2 of 3 · Statuses")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Todo ends the work" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Done ends the work" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "New cards start without a status" })).toBeChecked();
    expect(screen.getByText("Done is marked for you, from its name.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Todo ends the work" })).toHaveFocus(),
    );

    await user.click(screen.getByRole("checkbox", { name: "Todo ends the work" }));
    await user.click(screen.getByRole("radio", { name: "New cards start in Todo" }));
    await user.click(screen.getByRole("button", { name: /^Continue/ }));

    expect(screen.getByText("Roadmap · dev · Step 3 of 3 · Repositories")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "dev/web 4 cards" })).toBeChecked();
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "dev/web 4 cards" })).toHaveFocus(),
    );
    expect(screen.getByText("Registered · ~/projects/web")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Add board/ }));

    expect(api.addBoard).toHaveBeenCalledWith(URL, {
      finalStatuses: ["todo", "done"],
      newCardStatus: "todo",
      repositories: [{ owner: "dev", name: "web", path: "" }],
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("holds Continue while the field is empty, and reads with Enter", async () => {
    const { user } = dialog();

    const continueButton = screen.getByRole("button", { name: /^Continue/ });
    expect(continueButton).toHaveAttribute("aria-disabled", "true");
    expect(continueButton).toHaveAccessibleDescription("Paste the URL of a GitHub project.");
    await user.click(continueButton);
    expect(api.previewBoard).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", URL_FIELD), `${URL}{Enter}`);
    expect(api.previewBoard).toHaveBeenCalledWith(URL);
  });

  it("says it is reading, and puts the refusal under the URL with the focus back on it", async () => {
    let refuse: (reason: Error) => void = () => {};
    vi.mocked(api.previewBoard).mockReturnValue(
      new Promise((_, reject) => {
        refuse = reject;
      }),
    );
    const { user } = dialog();

    await readBoard(user);

    expect(screen.getByText("Reading the board…", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reading…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("textbox", URL_FIELD)).toHaveAttribute("aria-disabled", "true");

    refuse(new Error("Roadmap is already registered."));

    const field = screen.getByRole("textbox", URL_FIELD);
    await waitFor(() => {
      expect(field).toHaveAttribute("aria-invalid", "true");
    });
    expect(field).toHaveAccessibleDescription("Roadmap is already registered.");
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveValue(URL);
  });

  it("keeps what was chosen on Back, and doesn't read again for the same URL", async () => {
    const { user } = dialog();
    await readBoard(user);
    await user.click(await screen.findByRole("checkbox", { name: "Todo ends the work" }));
    await user.click(screen.getByRole("button", { name: /^Continue/ }));
    await user.click(screen.getByRole("checkbox", { name: "dev/web 4 cards" }));

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("checkbox", { name: "Todo ends the work" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(subtitleOf()).toBe("Step 1 of 3 · The project");
    expect(screen.getByRole("textbox", URL_FIELD)).toHaveValue(URL);
    await waitFor(() => expect(screen.getByRole("textbox", URL_FIELD)).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Continue/ }));
    await user.click(screen.getByRole("button", { name: /^Continue/ }));

    expect(api.previewBoard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("checkbox", { name: "dev/web 4 cards" })).not.toBeChecked();
  });

  it("reads again for a changed URL and starts the choices over", async () => {
    const { user } = dialog();
    await readBoard(user);
    await user.click(await screen.findByRole("checkbox", { name: "Todo ends the work" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    const field = screen.getByRole("textbox", URL_FIELD);
    await user.clear(field);
    await user.type(field, OTHER_URL);
    await user.click(screen.getByRole("button", { name: /^Continue/ }));

    expect(api.previewBoard).toHaveBeenLastCalledWith(OTHER_URL);
    expect(await screen.findByRole("checkbox", { name: "Todo ends the work" })).not.toBeChecked();
  });

  it("skips the statuses of a board without a Status field, and says so", async () => {
    vi.mocked(api.previewBoard).mockResolvedValue(
      makeBoardPreview({ title: "Release Train", hasStatus: false, statuses: [] }),
    );
    const { user } = dialog();

    await readBoard(user);

    expect(
      await screen.findByText("Release Train · dev · Step 2 of 2 · Repositories"),
    ).toBeVisible();
    expect(screen.getByText(/This board has no Status field/)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("shows how each repository ties, and takes the clone the user picks", async () => {
    vi.mocked(api.previewBoard).mockResolvedValue(
      makeBoardPreview({
        hasStatus: false,
        statuses: [],
        repositories: [
          makeBoardRepositoryOption({
            name: "api",
            fullName: "dev/api",
            link: "clone",
            repositoryId: "",
            path: "/home/dev/api",
            clones: ["/home/dev/api", "/work/api"],
          }),
          makeBoardRepositoryOption({
            name: "docs",
            fullName: "dev/docs",
            link: "uncloned",
            repositoryId: "",
            path: "",
          }),
          makeBoardRepositoryOption({
            name: "ops",
            fullName: "dev/ops",
            link: "other_board",
            otherBoard: "Billing",
          }),
        ],
      }),
    );
    const { user } = dialog();

    await readBoard(user);

    expect(await screen.findByText("Registered without a clone")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /dev\/ops/ })).toHaveAccessibleDescription(
      "dev/ops belongs to the board Billing.",
    );

    await user.click(screen.getByRole("button", { name: "Clone of dev/api: ~/api" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "/work/api" }));
    await user.click(screen.getByRole("checkbox", { name: "dev/docs 4 cards" }));
    await user.click(screen.getByRole("button", { name: /^Add board/ }));

    expect(api.addBoard).toHaveBeenCalledWith(URL, {
      finalStatuses: [],
      newCardStatus: "",
      repositories: [{ owner: "dev", name: "api", path: "/work/api" }],
    });
  });

  it("adds a typed repository in order, and shows why one is refused", async () => {
    vi.mocked(api.previewBoard).mockResolvedValue(makeBoardPreview({ hasStatus: false }));
    vi.mocked(api.checkBoardRepository)
      .mockRejectedValueOnce(new Error("dev/nope doesn't exist or this account can't read it."))
      .mockResolvedValueOnce(
        makeBoardRepositoryOption({
          name: "cli",
          fullName: "dev/cli",
          cards: 0,
          link: "uncloned",
          path: "",
          checked: false,
        }),
      );
    const { user } = dialog();
    await readBoard(user);

    const field = await screen.findByRole("textbox", { name: "Add a repository" });
    const add = screen.getByRole("button", { name: "Add" });
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).toHaveAccessibleDescription("Type a repository as owner/name.");
    await user.type(field, "dev/nope");
    expect(add).not.toHaveAttribute("aria-describedby");
    await user.click(add);

    expect(api.checkBoardRepository).toHaveBeenCalledWith("", "dev/nope");
    await waitFor(() => {
      expect(field).toHaveAccessibleDescription(
        "dev/nope doesn't exist or this account can't read it.",
      );
    });

    await user.clear(field);
    await user.type(field, "dev/cli{Enter}");

    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes.map((box) => box.textContent)).toEqual(["dev/cli 0 cards", "dev/web 4 cards"]);
    expect(screen.getByRole("checkbox", { name: "dev/cli 0 cards" })).toBeChecked();
    expect(field).toHaveValue("");
  });

  it("keeps the dialog open with the reason in the footer when saving fails", async () => {
    vi.mocked(api.previewBoard).mockResolvedValue(makeBoardPreview({ hasStatus: false }));
    vi.mocked(api.addBoard).mockRejectedValue(new Error("database is locked"));
    const { user, onOpenChange } = dialog();
    await readBoard(user);

    await user.click(await screen.findByRole("button", { name: /^Add board/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("database is locked");
    expect(screen.getByRole("button", { name: /^Add board/ })).not.toHaveAttribute("aria-busy");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("holds Cancel and Back while the board is saved", async () => {
    vi.mocked(api.previewBoard).mockResolvedValue(makeBoardPreview({ hasStatus: false }));
    vi.mocked(api.addBoard).mockReturnValue(new Promise(() => {}));
    const { user } = dialog();
    await readBoard(user);

    await user.click(await screen.findByRole("button", { name: /^Add board/ }));

    expect(screen.getByRole("button", { name: "Adding…" })).toHaveAttribute("aria-busy", "true");
    for (const name of ["Cancel", "Back", "Close"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("goes forward with Ctrl+Enter, and adds on the last step", async () => {
    const { user } = dialog();
    await user.type(screen.getByRole("textbox", URL_FIELD), URL);
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(await screen.findByText(/Step 2 of 3 · Statuses/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Todo ends the work" })).toHaveFocus(),
    );

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(screen.getByText(/Step 3 of 3 · Repositories/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /dev\/web/ })).toHaveFocus());

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(api.addBoard).toHaveBeenCalledTimes(1);
  });
});

describe("BoardDialog, editing", () => {
  it("opens reading the board, with only Cancel, and edits what it reads", async () => {
    let arrive: (preview: ReturnType<typeof makeBoardPreview>) => void = () => {};
    vi.mocked(api.previewEditBoard).mockReturnValue(
      new Promise((resolve) => {
        arrive = resolve;
      }),
    );
    const { user, onOpenChange } = dialog({ mode: "edit", boardId: "board-1" });

    expect(screen.getByRole("dialog", { name: "Edit board" })).toBeInTheDocument();
    expect(api.previewEditBoard).toHaveBeenCalledWith("board-1");
    expect(screen.getByRole("status")).toHaveTextContent("Reading the board…");
    expect(subtitleOf()).toBe("Platform Roadmap · dev");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    expect(screen.queryByRole("button", { name: /Continue|Save/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", URL_FIELD)).not.toBeInTheDocument();

    arrive(makeBoardPreview({ title: "Platform Roadmap", newCardStatus: "todo" }));

    expect(
      await screen.findByText("Platform Roadmap · dev · Step 1 of 2 · Statuses"),
    ).toBeVisible();
    // The board keeps the status its new cards are created with.
    expect(screen.getByRole("radio", { name: "New cards start in Todo" })).toBeChecked();
    expect(screen.queryByText(/is marked for you/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Continue/ }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /dev\/web/ })).toHaveFocus());
    await user.type(screen.getByRole("textbox", { name: "Add a repository" }), "dev/cli");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(api.checkBoardRepository).toHaveBeenCalledWith("board-1", "dev/cli");

    await user.click(screen.getByRole("button", { name: /^Save/ }));

    expect(api.updateBoard).toHaveBeenCalledWith("board-1", {
      finalStatuses: ["done"],
      newCardStatus: "todo",
      repositories: [{ owner: "dev", name: "web", path: "" }],
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("fails reading with the reason in the body, and Try again reads it again", async () => {
    vi.mocked(api.previewEditBoard).mockRejectedValueOnce(new Error("GitHub is unreachable."));
    const { user } = dialog({ mode: "edit", boardId: "board-1" });

    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub is unreachable.");
    const retry = screen.getByRole("button", { name: /^Try again/ });
    await waitFor(() => expect(retry).toHaveFocus());
    expect(subtitleOf()).toBe("Platform Roadmap · dev");

    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.previewEditBoard).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/Step 1 of 2 · Statuses/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tells what changed on the board since it was saved", async () => {
    vi.mocked(api.previewEditBoard).mockResolvedValue(
      makeBoardPreview({
        statuses: [
          { id: "todo", name: "Todo", final: false },
          { id: "qa", name: "QA", final: false },
        ],
        goneStatuses: ["Archived"],
        newStatusIds: ["qa"],
        newCardStatusGone: true,
      }),
    );
    dialog({ mode: "edit", boardId: "board-1" });

    expect(
      await screen.findByText(
        "The board changed since it was saved. Archived is gone from its statuses, and QA is new, not marked. New cards now start with no status.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();
  });

  it("goes straight to the repositories of a board without a Status field", async () => {
    vi.mocked(api.previewEditBoard).mockResolvedValue(
      makeBoardPreview({ title: "Release Train", hasStatus: false, statuses: [] }),
    );
    dialog({ mode: "edit", boardId: "board-1" });

    expect(await screen.findByText("Release Train · dev · Repositories")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("says what unchecking a repository does, and sums it beside Save", async () => {
    vi.mocked(api.previewEditBoard).mockResolvedValue(
      makeBoardPreview({
        hasStatus: false,
        statuses: [],
        repositories: [
          makeBoardRepositoryOption({ release: "no_board" }),
          makeBoardRepositoryOption({
            name: "docs",
            fullName: "dev/docs",
            repositoryId: "repo-2",
            path: "",
            release: "leave",
          }),
        ],
      }),
    );
    const { user } = dialog({ mode: "edit", boardId: "board-1" });
    await screen.findByRole("checkbox", { name: "dev/web 4 cards" });

    expect(screen.queryByText(/^→/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "dev/web 4 cards" }));
    await user.click(screen.getByRole("checkbox", { name: "dev/docs 4 cards" }));

    const web = "Moves to No board: it has a clone and 3 archived tasks. Its tasks keep working.";
    expect(screen.getByText(`→ ${web}`)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "dev/web 4 cards" })).toHaveAccessibleDescription(
      `→ ${web}`,
    );
    expect(
      screen.getByText("→ Leaves MySpec: it has no clone, tasks or reviews."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("dev/web moves to No board, and dev/docs leaves MySpec."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "dev/web 4 cards" }));
    expect(screen.queryByText(`→ ${web}`)).not.toBeInTheDocument();
    expect(screen.getByText("dev/docs leaves MySpec.")).toBeInTheDocument();
  });
});
