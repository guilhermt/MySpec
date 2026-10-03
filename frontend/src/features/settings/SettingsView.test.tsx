import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { SettingsView } from "@/features/settings/SettingsView";
import type { Location, SettingsSection } from "@/lib/locations";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makePrompt, makeState } from "@/test/wails-mock";

// Shortcuts is the app's keyboard, which closes Settings with Esc and Ctrl+,.
function Shortcuts() {
  useGlobalShortcuts();
  return null;
}

function view(section: SettingsSection = "defaults", back: Location[] = []) {
  return renderWithStore(
    <>
      <Shortcuts />
      <SettingsView />
    </>,
    {
      state: makeState(),
      ui: { location: { kind: "settings", section }, back },
    },
  );
}

const body = () => document.querySelector(".settings-body")?.parentElement as HTMLElement;

describe("SettingsView", () => {
  it("names the place Settings, with its navigation and the page of the section", () => {
    view();

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Defaults" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 2, name: "Defaults" })).toBeInTheDocument();
  });

  it.each([
    ["boards", "Boards"],
    ["repositories", "Repositories"],
    ["prompts", "Prompts"],
  ] as const)("shows the page %s", async (section, title) => {
    view(section);

    expect(await screen.findByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: title })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("heading", { level: 2, name: "Defaults" })).not.toBeInTheDocument();
  });

  it("shows a prompt on the page Prompts", async () => {
    vi.mocked(api.getPrompt).mockResolvedValue(makePrompt());
    view("prd");

    expect(await screen.findByTestId("markdown")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prompts" })).toHaveAttribute("aria-current", "page");
  });

  it("changes the page from the navigation without stacking a place", async () => {
    const { user } = view();

    await user.click(screen.getByRole("link", { name: "Repositories" }));

    expect(screen.getByRole("heading", { level: 2, name: "Repositories" })).toBeInTheDocument();
    expect(screen.getByText("dev/web")).toBeInTheDocument();
    expect(useAppStore.getState().back).toEqual([]);
  });

  it("closes from the header with Close, back to the place before", async () => {
    const { user } = view("defaults", [{ kind: "history" }]);

    await user.click(screen.getByRole("button", { name: /^Close/ }));

    expect(useAppStore.getState().location).toEqual({ kind: "history" });
  });

  it("says where Close goes, in its tooltip", async () => {
    const { user } = view("defaults", [{ kind: "history" }]);

    await user.hover(screen.getByRole("button", { name: /^Close/ }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Close Settings and go back to History · Esc",
    );
  });

  it("says only that it closes when there is nowhere to go back to", async () => {
    const { user } = view();

    await user.hover(screen.getByRole("button", { name: /^Close/ }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Close Settings · Esc");
  });

  it("closes with Esc and with Ctrl+,", async () => {
    const { user } = view("defaults", [{ kind: "history" }]);

    await user.keyboard("{Escape}");

    expect(useAppStore.getState().location).toEqual({ kind: "history" });

    act(() => useAppStore.getState().openSettings());
    await user.keyboard("{Control>},{/Control}");

    expect(useAppStore.getState().location).toEqual({ kind: "history" });
  });

  it("brings a page back to the top when the page changes", async () => {
    const { user } = view();
    body().scrollTop = 240;

    await user.click(screen.getByRole("link", { name: "Boards" }));

    await waitFor(() => expect(body().scrollTop).toBe(0));
  });

  it("keeps the scroll while the section changes inside a page", async () => {
    vi.mocked(api.getPrompt).mockResolvedValue(makePrompt());
    view("prompts");
    await screen.findByRole("heading", { level: 2, name: "Prompts" });
    body().scrollTop = 120;

    act(() => useAppStore.getState().selectSettingsSection("prd"));
    await screen.findByTestId("markdown");

    expect(body().scrollTop).toBe(120);
  });

  it("asks before the navigation loses an edit of a prompt", async () => {
    vi.mocked(api.getPrompt).mockResolvedValue(makePrompt());
    const { user } = view("prd");
    await screen.findByTestId("markdown");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(await screen.findByRole("textbox", { name: "PRD prompt" }), " More.");

    await user.click(screen.getByRole("link", { name: "Boards" }));

    expect(await screen.findByText("Discard your changes?")).toBeInTheDocument();
    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "prd" });
  });
});
