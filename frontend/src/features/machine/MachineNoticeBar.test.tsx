import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MachineNoticeBar } from "@/features/machine/MachineNoticeBar";
import type { Location } from "@/lib/locations";
import type { Machine } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeMachine, makeState, withMachineItems } from "@/test/wails-mock";

const lacking = (changes: Parameters<typeof withMachineItems>[1]): Machine =>
  withMachineItems(makeMachine({ notice: true }), changes);

function bar(
  machine: Machine,
  options: { welcome?: boolean; location?: Location; dismissed?: boolean } = {},
) {
  // Nothing registered and nothing active is the welcome.
  return renderWithStore(<MachineNoticeBar />, {
    state: makeState({
      machine,
      ...(options.welcome === true ? { repositories: [], boards: [], tasks: [] } : {}),
    }),
    ui: {
      location: options.location ?? { kind: "home" },
      machineNoticeDismissed: options.dismissed === true,
    },
  });
}

describe("MachineNoticeBar", () => {
  it("names the missing item", () => {
    bar(lacking({ claude_login: { result: "missing" } }));

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Claude Code isn't logged in");
    expect(notice).toHaveTextContent("Sessions won't start.");
  });

  it("counts the missing items when there are several", () => {
    bar(lacking({ claude_login: { result: "missing" }, gh_login: { result: "missing" } }));

    expect(screen.getByRole("status")).toHaveTextContent("2 things on this machine need attention");
  });

  it("is absent without the notice of the check", () => {
    bar(makeMachine({ notice: false }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is absent in the welcome", () => {
    bar(lacking({ claude_login: { result: "missing" } }), { welcome: true });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is absent in Settings › Machine", () => {
    bar(lacking({ claude_login: { result: "missing" } }), {
      location: { kind: "settings", section: "machine" },
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is absent once dismissed, and Dismiss dismisses it", async () => {
    const { user } = bar(lacking({ claude_login: { result: "missing" } }));

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(useAppStore.getState().machineNoticeDismissed).toBe(true);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays absent when it was dismissed before", () => {
    bar(lacking({ claude_login: { result: "missing" } }), { dismissed: true });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("opens Settings › Machine", async () => {
    const { user } = bar(lacking({ claude_login: { result: "missing" } }));

    await user.click(screen.getByRole("button", { name: "Open Settings › Machine" }));

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "machine" });
  });
});
