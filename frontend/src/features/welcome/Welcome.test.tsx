import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "@/features/welcome/Welcome";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeMachine, makeState, withMachineItems } from "@/test/wails-mock";

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

  it("checks the machine when it shows and when the window comes back", async () => {
    welcome();
    await waitFor(() => expect(api.checkMachine).toHaveBeenCalledTimes(1));

    fireEvent.focus(window);

    await waitFor(() => expect(api.checkMachine).toHaveBeenCalledTimes(2));
  });

  it("shows no This machine when nothing is missing", () => {
    welcome();

    expect(screen.queryByRole("region", { name: "This machine" })).not.toBeInTheDocument();
  });

  it("shows no This machine before the first check, with nothing known", () => {
    welcome({ machine: makeMachine({ checked: false, items: [] }) });

    expect(screen.queryByRole("region", { name: "This machine" })).not.toBeInTheDocument();
  });

  it("lists what the machine lacks, with what to do and the command to copy", () => {
    welcome({
      machine: withMachineItems(makeMachine(), {
        claude_found: { result: "missing" },
        claude_login: { result: "unchecked", reason: "depends" },
        claude_version: { result: "unchecked", reason: "depends" },
        gh_login: { result: "missing" },
        gh_scopes: { result: "unchecked", reason: "depends" },
      }),
    });

    const region = screen.getByRole("region", { name: "This machine" });
    expect(region).toHaveTextContent("Claude Code was not found");
    expect(region).toHaveTextContent("The GitHub CLI isn't signed in");
    expect(screen.getByRole("button", { name: "Copy gh auth login" })).toBeInTheDocument();
  });

  it("leaves an unchecked item out", () => {
    welcome({
      machine: withMachineItems(makeMachine(), {
        gh_scopes: { result: "unchecked", reason: "failed" },
      }),
    });

    expect(screen.queryByRole("region", { name: "This machine" })).not.toBeInTheDocument();
  });

  it("announces what Check again found", async () => {
    vi.mocked(api.checkMachine).mockResolvedValue(
      withMachineItems(makeMachine(), { gh_login: { result: "missing" } }),
    );
    const { user } = welcome({
      machine: withMachineItems(makeMachine(), { gh_login: { result: "missing" } }),
    });

    await user.click(screen.getByRole("button", { name: "Check again" }));

    await waitFor(() =>
      expect(useAppStore.getState().announcement?.text).toBe(
        "Checked this machine: The GitHub CLI isn't signed in.",
      ),
    );
  });

  it("puts the focus on Add board when Check again clears the last lack", async () => {
    const { user } = welcome({
      machine: withMachineItems(makeMachine(), { gh_login: { result: "missing" } }),
    });
    screen.getByRole("button", { name: "Check again" }).focus();
    vi.mocked(api.checkMachine).mockResolvedValue(makeMachine());

    await user.click(screen.getByRole("button", { name: "Check again" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Add board" })).toHaveFocus());
  });
});
