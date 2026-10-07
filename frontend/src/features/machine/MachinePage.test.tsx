import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MachinePage } from "@/features/machine/MachinePage";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeMachine, makeState, withMachineItems } from "@/test/wails-mock";

function page(machine = makeMachine()) {
  return renderWithStore(<MachinePage />, { state: makeState({ machine }) });
}

beforeEach(() => {
  vi.mocked(api.checkMachine).mockResolvedValue(makeMachine());
});

describe("MachinePage", () => {
  it("says it is checking before the first check ends", () => {
    page(makeMachine({ checked: false, items: [] }));

    expect(screen.getByText("Checking this machine…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("lists the three items of each tool when everything is right", () => {
    page();

    expect(screen.getByRole("heading", { level: 2, name: "Machine" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Claude Code" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "GitHub CLI" })).toBeInTheDocument();
    expect(screen.getByText("Claude Code is installed")).toBeInTheDocument();
    expect(screen.getByText("Claude Code is logged in")).toBeInTheDocument();
    expect(screen.getByText("Claude Code 2.1.291")).toBeInTheDocument();
    expect(screen.getByText("The GitHub CLI is installed")).toBeInTheDocument();
    expect(screen.getByText("The GitHub CLI is signed in")).toBeInTheDocument();
    expect(screen.getByText("As octocat.")).toBeInTheDocument();
    expect(screen.getByText("The GitHub CLI has the project and repo scopes")).toBeInTheDocument();
  });

  it("says what is missing, with the command, and what was not checked", () => {
    page(
      withMachineItems(makeMachine({ missingScopes: ["repo"] }), {
        claude_login: { result: "missing" },
        gh_scopes: { result: "missing" },
        claude_version: { result: "unchecked", reason: "timeout" },
      }),
    );

    expect(screen.getByText("Claude Code isn't logged in")).toBeInTheDocument();
    expect(screen.getByText("The GitHub CLI lacks the repo scope")).toBeInTheDocument();
    expect(screen.getByText("gh auth refresh -s repo")).toBeInTheDocument();
    expect(screen.getByText("Claude Code's version wasn't checked")).toBeInTheDocument();
    expect(screen.getByText("Claude Code didn't answer in 10 seconds.")).toBeInTheDocument();
  });

  it("checks again and announces what it found", async () => {
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "Check again" }));

    await waitFor(() =>
      expect(useAppStore.getState().announcement?.text).toBe(
        "Checked this machine: nothing is missing.",
      ),
    );
    expect(api.checkMachine).toHaveBeenCalledOnce();
  });

  it("shows Checking… while a check runs, and a click does nothing", async () => {
    const { user } = page(makeMachine({ running: true }));

    const button = screen.getByRole("button", { name: /Checking…/ });
    await user.click(button);

    expect(api.checkMachine).not.toHaveBeenCalled();
    expect(within(button).queryByText("Check again")).not.toBeInTheDocument();
  });
});
