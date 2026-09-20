import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardDialog, type BoardDialogProps } from "@/features/boards/BoardDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeBoardPreview,
  makeBoardRepositoryOption,
  makeState,
} from "@/test/wails-mock";

const URL = "https://github.com/orgs/dev/projects/3";

function dialog(mode: { mode: "add" } | { mode: "edit"; boardId: string } = { mode: "add" }) {
  const onOpenChange = vi.fn();
  const props = { ...mode, open: true, onOpenChange } as BoardDialogProps;
  const rendered = renderWithStore(<BoardDialog {...props} />, {
    state: makeState({ boards: [makeBoard()] }),
  });
  return { ...rendered, onOpenChange };
}

/** readBoard pastes the URL of the board and reads it. */
async function readBoard(user: ReturnType<typeof dialog>["user"]) {
  await user.type(screen.getByRole("textbox", { name: "Board URL" }), URL);
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

describe("BoardDialog", () => {
  it("adds a board through its final statuses and its repositories", async () => {
    const { user, onOpenChange } = dialog();

    await readBoard(user);

    expect(api.previewBoard).toHaveBeenCalledWith(URL);
    expect(await screen.findByText(/^Roadmap · dev/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Todo Final" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Done Final" })).toBeChecked();

    expect(screen.getByRole("radio", { name: "None" })).toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "Todo Final" }));
    await user.click(screen.getByRole("radio", { name: "Todo" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("checkbox", { name: "dev/web" })).toBeChecked();
    expect(screen.getByText("4 cards")).toBeInTheDocument();
    expect(screen.getByText("Registered · /home/dev/projects/web")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add board" }));

    expect(api.addBoard).toHaveBeenCalledWith(URL, {
      finalStatuses: ["todo", "done"],
      newCardStatus: "todo",
      repositories: [{ owner: "dev", name: "web", path: "" }],
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("says it is reading, and shows why a board can't be read under the URL", async () => {
    let refuse: (reason: Error) => void = () => {};
    vi.mocked(api.previewBoard).mockReturnValue(
      new Promise((_, reject) => {
        refuse = reject;
      }),
    );
    const { user } = dialog();

    await readBoard(user);

    expect(screen.getByRole("status")).toHaveTextContent("Reading the board…");

    refuse(new Error("Roadmap is already registered."));

    expect(await screen.findByRole("alert")).toHaveTextContent("Roadmap is already registered.");
    expect(screen.getByRole("textbox", { name: "Board URL" })).toHaveValue(URL);
  });

  it("skips the statuses of a board without a Status field", async () => {
    vi.mocked(api.previewBoard).mockResolvedValue(
      makeBoardPreview({ hasStatus: false, statuses: [] }),
    );
    const { user } = dialog();

    await readBoard(user);

    expect(await screen.findByRole("checkbox", { name: "dev/web" })).toBeInTheDocument();
    expect(screen.queryByText("Final")).not.toBeInTheDocument();
    expect(screen.queryByText("Status for new cards")).not.toBeInTheDocument();
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
    expect(screen.getByText("dev/ops belongs to the board Billing.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "dev/ops" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Clone of dev/api: /home/dev/api" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "/work/api" }));
    await user.click(screen.getByRole("checkbox", { name: "dev/docs" }));
    await user.click(screen.getByRole("button", { name: "Add board" }));

    expect(api.addBoard).toHaveBeenCalledWith(URL, {
      finalStatuses: [],
      newCardStatus: "",
      repositories: [{ owner: "dev", name: "api", path: "/work/api" }],
    });
  });

  it("adds a typed repository, and shows why one is refused", async () => {
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
        }),
      );
    const { user } = dialog();
    await readBoard(user);

    const field = await screen.findByRole("textbox", { name: "Add a repository" });
    await user.type(field, "dev/nope");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(api.checkBoardRepository).toHaveBeenCalledWith("", "dev/nope");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "dev/nope doesn't exist or this account can't read it.",
    );

    await user.clear(field);
    await user.type(field, "dev/cli");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("checkbox", { name: "dev/cli" })).toBeChecked();
    expect(screen.getByText("0 cards")).toBeInTheDocument();
    expect(field).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the dialog open with the reason when saving fails", async () => {
    vi.mocked(api.previewBoard).mockResolvedValue(makeBoardPreview({ hasStatus: false }));
    vi.mocked(api.addBoard).mockRejectedValue(new Error("database is locked"));
    const { user, onOpenChange } = dialog();
    await readBoard(user);

    await user.click(await screen.findByRole("button", { name: "Add board" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("database is locked");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("edits a board read again from GitHub and saves it", async () => {
    vi.mocked(api.previewEditBoard).mockResolvedValue(makeBoardPreview({ newCardStatus: "todo" }));
    const { user, onOpenChange } = dialog({ mode: "edit", boardId: "board-1" });

    expect(screen.getByRole("dialog", { name: "Edit board" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Board URL" })).not.toBeInTheDocument();
    expect(api.previewEditBoard).toHaveBeenCalledWith("board-1");

    // The board keeps the status its new cards are created with.
    expect(await screen.findByRole("radio", { name: "Todo" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(screen.getByRole("textbox", { name: "Add a repository" }), "dev/cli");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(api.checkBoardRepository).toHaveBeenCalledWith("board-1", "dev/cli");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(api.updateBoard).toHaveBeenCalledWith("board-1", {
      finalStatuses: ["done"],
      newCardStatus: "todo",
      repositories: [{ owner: "dev", name: "web", path: "" }],
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows why a board being edited can't be read", async () => {
    vi.mocked(api.previewEditBoard).mockRejectedValue(
      new Error("The board doesn't exist or this account can't read it."),
    );
    dialog({ mode: "edit", boardId: "board-1" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The board doesn't exist or this account can't read it.",
    );
  });
});
