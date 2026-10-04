import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarFooter } from "@/features/sidebar/SidebarFooter";
import type { Location } from "@/lib/locations";
import type { State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeHistorySummary, makeState } from "@/test/wails-mock";

// Two archived tasks, one archived review and no archived discussion.
function archive(): State {
  return makeState({ historySummary: makeHistorySummary({ tasks: 2, reviews: 1 }) });
}

function footer(options: { rail?: boolean; state?: State; location?: Location } = {}) {
  return renderWithStore(<SidebarFooter rail={options.rail ?? false} />, {
    state: options.state ?? archive(),
    ...(options.location !== undefined ? { ui: { location: options.location } } : {}),
  });
}

describe("SidebarFooter", () => {
  it("counts what is archived on History, and tells it by kind", async () => {
    const { user } = footer();

    const history = screen.getByRole("button", { name: "History 3" });
    await user.hover(history);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "3 archived: 2 tasks, 1 review, 0 discussions",
    );
  });

  it("shows no count with nothing archived", () => {
    footer({
      state: makeState(),
    });

    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
  });

  it("opens History", async () => {
    const { user } = footer();

    await user.click(screen.getByRole("button", { name: "History 3" }));

    expect(useAppStore.getState().location).toEqual({ kind: "history" });
  });

  it.each<[string, Location]>([
    ["History", { kind: "history" }],
    ["an archived task", { kind: "archived-task", id: "old-1" }],
    ["an archived discussion", { kind: "archived-discussion", id: "d" }],
  ])("presses History with %s on screen", (_, location) => {
    footer({
      state: makeState({
        historySummary: makeHistorySummary({ tasks: 2, reviews: 1, discussions: 1 }),
      }),
      location,
    });

    const history = screen.getByRole("button", { name: /^History/ });
    expect(history).toHaveAttribute("aria-pressed", "true");
    expect(history).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Settings" })).not.toHaveAttribute("aria-current");
  });

  it("opens Settings, pressed while they are on screen, and closes them back", async () => {
    const { user } = footer({ location: { kind: "history" } });

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "defaults" });
    const settings = screen.getByRole("button", { name: "Settings" });
    expect(settings).toHaveAttribute("aria-pressed", "true");
    expect(settings).toHaveAttribute("aria-current", "page");

    await user.click(settings);

    expect(useAppStore.getState().location).toEqual({ kind: "history" });
  });

  it("tells the key of Settings", async () => {
    const { user } = footer();

    await user.hover(screen.getByRole("button", { name: "Settings" }));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Settings");
    expect(tooltip).toHaveTextContent("Ctrl+,");
  });

  it("holds the theme between History and Settings", () => {
    footer();

    const names = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names).toEqual(["History 3", "Theme: System", "Settings"]);
  });

  it("stacks the three as icon buttons on the strip, the count in the name only", async () => {
    const { user } = footer({ rail: true });

    const history = screen.getByRole("button", {
      name: "History · 3 archived: 2 tasks, 1 review, 0 discussions",
    });
    expect(history).not.toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "defaults" });
  });

  it("in the welcome mode dashes History with nothing archived and still opens Settings", async () => {
    const { user } = renderWithStore(<SidebarFooter welcome />, { state: makeState() });

    const history = screen.getByRole("button", { name: "History" });
    expect(history).toHaveAttribute("aria-disabled", "true");
    expect(history).toHaveAccessibleDescription("Nothing archived yet");

    await user.click(history);
    expect(useAppStore.getState().location.kind).toBe("home");

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(useAppStore.getState().location.kind).toBe("settings");
  });

  it("in the welcome mode opens History once something is archived", async () => {
    const { user } = renderWithStore(<SidebarFooter welcome />, { state: archive() });
    expect(screen.getByRole("button", { name: "History 3" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "History 3" }));
    expect(useAppStore.getState().location.kind).toBe("history");
  });
});
