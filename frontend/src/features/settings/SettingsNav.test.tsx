import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsNav } from "@/features/settings/SettingsNav";
import type { SettingsSection } from "@/lib/locations";
import type { Machine } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeMachine, makeRepository, makeState, withMachineItems } from "@/test/wails-mock";

// Place is the nav where Settings keeps it: there while the place is Settings, so a test can open it.
function Place() {
  const settings = useAppStore((state) => state.location.kind === "settings");
  return settings ? <SettingsNav /> : null;
}

function nav(
  section: SettingsSection = "defaults",
  options: { pendingFocus?: "nav" | null; missing?: boolean; machine?: Machine } = {},
) {
  const state = makeState({
    ...(options.machine !== undefined ? { machine: options.machine } : {}),
    repositories: [
      makeRepository({ id: "r1", fullName: "acme/api" }),
      makeRepository({ id: "r2", fullName: "acme/infra", missing: options.missing === true }),
    ],
  });
  return renderWithStore(<Place />, {
    state,
    ui: {
      location: { kind: "settings", section },
      pendingFocus: options.pendingFocus ?? null,
    },
  });
}

const link = (name: string) => screen.getByRole("link", { name });
const section = () => {
  const { location } = useAppStore.getState();
  return location.kind === "settings" ? location.section : null;
};

describe("SettingsNav", () => {
  it("lists the five pages as links and marks the open one as the current page", () => {
    nav("boards");

    const list = screen.getByRole("navigation", { name: "Settings" });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((item) => item.textContent)).toEqual([
      "Defaults",
      "Boards",
      "Repositories",
      "Prompts",
      "Machine",
    ]);
    expect(link("Boards")).toHaveAttribute("aria-current", "page");
    expect(link("Defaults")).not.toHaveAttribute("aria-current");
  });

  it("opens Prompts for any prompt", () => {
    nav("pr_review");

    expect(link("Prompts")).toHaveAttribute("aria-current", "page");
  });

  it("is one stop of Tab: the open page", async () => {
    const { user } = nav("boards");

    expect(link("Boards")).toHaveAttribute("tabindex", "0");
    expect(link("Defaults")).toHaveAttribute("tabindex", "-1");

    await user.tab();

    expect(link("Boards")).toHaveFocus();
  });

  it("opens a page with a click and keeps the focus where it was", async () => {
    const { user } = nav();

    await user.click(link("Repositories"));

    expect(section()).toBe("repositories");
    expect(useAppStore.getState().pendingFocus).toBeNull();
  });

  it("opens the page an arrow reaches and moves the focus to it", async () => {
    const { user } = nav();
    link("Defaults").focus();

    await user.keyboard("{ArrowDown}");

    expect(section()).toBe("boards");
    expect(link("Boards")).toHaveFocus();

    await user.keyboard("{ArrowDown}{ArrowUp}");

    expect(section()).toBe("boards");
    expect(link("Boards")).toHaveFocus();
  });

  it("goes to the ends with Home and End, and doesn't wrap", async () => {
    const { user } = nav("boards");
    link("Boards").focus();

    await user.keyboard("{End}");

    expect(section()).toBe("machine");
    expect(link("Machine")).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(section()).toBe("machine");

    await user.keyboard("{Home}");

    expect(section()).toBe("defaults");

    await user.keyboard("{ArrowUp}");

    expect(section()).toBe("defaults");
  });

  it("leaves the side arrows to the page while the navigation is a column", async () => {
    const { user } = nav("boards");
    screen.getByRole("list").style.flexDirection = "column";
    link("Boards").focus();

    await user.keyboard("{ArrowRight}");

    expect(section()).toBe("boards");
  });

  it("takes the side arrows too while the navigation is a row", async () => {
    const { user } = nav("boards");
    const list = screen.getByRole("list");
    list.style.flexDirection = "row";
    link("Boards").focus();

    await user.keyboard("{ArrowRight}");

    expect(section()).toBe("repositories");
    expect(link("Repositories")).toHaveFocus();

    await user.keyboard("{ArrowLeft}{ArrowLeft}");

    expect(section()).toBe("defaults");
  });

  it.each([
    ["Alt", { altKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
    ["Shift", { shiftKey: true }],
  ])("leaves an arrow with %s to whoever else takes it", (_, modifier) => {
    nav("boards");
    screen.getByRole("list").style.flexDirection = "row";

    const kept = fireEvent.keyDown(link("Boards"), { key: "ArrowLeft", ...modifier });

    expect(kept).toBe(true);
    expect(section()).toBe("boards");
  });

  it("takes the focus to the open page when Settings is opened by the keyboard, and not by the click", () => {
    nav("defaults");
    act(() => useAppStore.getState().closeSettings());
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    act(() => useAppStore.getState().openSettings());

    expect(link("Defaults")).toHaveFocus();
    expect(useAppStore.getState().pendingFocus).toBeNull();

    act(() => useAppStore.getState().closeSettings());
    act(() => useAppStore.getState().openSettings(undefined, null));

    expect(link("Defaults")).not.toHaveFocus();
  });

  it("takes the focus to the page it was asked to open", () => {
    nav("defaults", { pendingFocus: "nav" });

    expect(link("Defaults")).toHaveFocus();
  });

  it("marks Repositories with the number of missing clones, described for a screen reader", () => {
    nav("defaults", { missing: true });

    expect(link("Repositories")).toHaveAccessibleDescription("The clone of acme/infra is missing");
    expect(link("Repositories")).toHaveTextContent("Repositories1");
  });

  it("says nothing when no clone is missing", () => {
    nav("defaults");

    expect(link("Repositories")).not.toHaveAccessibleDescription();
    expect(link("Repositories")).toHaveTextContent(/^Repositories$/);
  });

  it("marks Machine with the number of missing items, described for a screen reader", () => {
    const machine = withMachineItems(makeMachine(), {
      claude_login: { result: "missing" },
      gh_login: { result: "missing" },
    });
    nav("defaults", { machine });

    expect(link("Machine")).toHaveAccessibleDescription("2 things are missing on this machine");
    expect(link("Machine")).toHaveTextContent("Machine2");
  });

  it("names the missing item on Machine when only one is", () => {
    nav("defaults", {
      machine: withMachineItems(makeMachine(), { gh_found: { result: "missing" } }),
    });

    expect(link("Machine")).toHaveAccessibleDescription("The GitHub CLI isn't installed");
  });

  it("says nothing on Machine when nothing is missing", () => {
    nav("defaults", { machine: makeMachine() });

    expect(link("Machine")).not.toHaveAccessibleDescription();
    expect(link("Machine")).toHaveTextContent(/^Machine$/);
  });
});
