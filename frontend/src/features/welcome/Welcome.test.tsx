import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "@/features/welcome/Welcome";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeMachine, makeState } from "@/test/wails-mock";

function welcome(overrides: Parameters<typeof makeState>[0] = {}) {
  return renderWithStore(<Welcome />, {
    state: makeState({
      repositories: [],
      boards: [],
      tasks: [],
      reviews: [],
      discussions: [],
      ...overrides,
    }),
  });
}

beforeEach(() => {
  vi.mocked(api.checkMachine).mockResolvedValue(makeMachine());
});

describe("Welcome", () => {
  it("welcomes with the title, the sentence and the two ways to start", () => {
    welcome();

    expect(screen.getByRole("heading", { level: 1, name: "Welcome to MySpec" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    expect(
      screen.getByText(
        "MySpec runs Claude Code through a task, from the card on your GitHub board to the merged pull request. Register where your work lives to start.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add board" })).toHaveAccessibleDescription(
      "A GitHub project. Its cards start tasks, and the repositories of its issues come with it.",
    );
    expect(screen.getByRole("button", { name: "Add repository" })).toHaveAccessibleDescription(
      "A clone on this machine, for tasks without a board.",
    );
  });

  it("puts the focus on Add board", () => {
    welcome();

    expect(screen.getByRole("button", { name: "Add board" })).toHaveFocus();
  });

  it("takes the focus to the title when the way back from Settings asks for it", async () => {
    renderWithStore(<Welcome />, {
      state: makeState({ repositories: [], boards: [], tasks: [] }),
      ui: { pendingFocus: "title" },
    });

    expect(screen.getByRole("heading", { name: "Welcome to MySpec" })).toHaveFocus();
    await waitFor(() => expect(useAppStore.getState().pendingFocus).toBeNull());
    expect(screen.getByRole("button", { name: "Add board" })).not.toHaveFocus();
  });

  it("opens the board dialog from Add board and the clone scan from Add repository", async () => {
    const { user } = welcome();

    await user.click(screen.getByRole("button", { name: "Add board" }));
    expect(await screen.findByRole("dialog", { name: "Add board" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Add repository" }));
    expect(await screen.findByRole("dialog", { name: "Add repository" })).toBeInTheDocument();
  });

  it("shows no This machine when nothing is missing", async () => {
    welcome();

    await waitFor(() => expect(api.checkMachine).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "This machine" })).not.toBeInTheDocument();
  });

  it("lists what the machine lacks, with the command to copy", async () => {
    vi.mocked(api.checkMachine).mockResolvedValue(
      makeMachine({ claude: "not_found", gh: "signed_out" }),
    );
    welcome();

    const region = await screen.findByRole("region", { name: "This machine" });
    expect(region).toHaveTextContent("Claude Code was not found");
    expect(region).toHaveTextContent("The GitHub CLI isn't signed in");
    expect(screen.getByRole("button", { name: "Copy gh auth login" })).toBeInTheDocument();
  });

  it("leaves an unknown item out", async () => {
    vi.mocked(api.checkMachine).mockResolvedValue(
      makeMachine({ claude: "unknown", gh: "not_installed" }),
    );
    welcome();

    const region = await screen.findByRole("region", { name: "This machine" });
    expect(region).not.toHaveTextContent("Claude Code");
    expect(region).toHaveTextContent("The GitHub CLI isn't installed");
  });

  it("checks again when the models are read and when the window comes back", async () => {
    welcome();
    await waitFor(() => expect(api.checkMachine).toHaveBeenCalledTimes(1));

    vi.mocked(api.checkMachine).mockResolvedValue(makeMachine({ claude: "not_found" }));
    act(() => {
      const app = useAppStore.getState().app;
      if (app !== null) {
        useAppStore
          .getState()
          .applyState({ ...app, modelCatalog: { models: [], failure: "not_found" } });
      }
    });

    expect(await screen.findByText("Claude Code was not found")).toBeInTheDocument();
    expect(api.checkMachine).toHaveBeenCalledTimes(2);

    vi.mocked(api.checkMachine).mockResolvedValue(makeMachine());
    fireEvent.focus(window);

    await waitFor(() => expect(api.checkMachine).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.queryByText("Claude Code was not found")).toBeNull());
  });

  it("shows nothing when the check cannot be made", async () => {
    vi.mocked(api.checkMachine).mockRejectedValue(new Error("no answer"));
    welcome();

    await waitFor(() => expect(api.checkMachine).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "This machine" })).not.toBeInTheDocument();
  });
});
