import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { AppShell } from "@/app/AppShell";
import { machineItems } from "@/features/welcome/machine";
import {
  capture,
  cutTexts,
  edgesOf,
  offWholePixels,
  setTheme,
  settle,
  THEMES,
  visiblePrimaries,
  windowForMain,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { fixSettingsSceneClock, WELCOME_VARIATIONS, welcomeScene } from "@/test/settings-scenes";
import { api, resetWailsMock } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** WIDE_MAIN is the main area of a 2560px window; HALF_MAIN the one of half a monitor. */
const WIDE_MAIN = 2180;
const HALF_MAIN = 978;

const CASES = WELCOME_VARIATIONS.flatMap((variation) =>
  [WIDE_MAIN, HALF_MAIN].map((width) => [variation, width] as const),
);

fixSettingsSceneClock();

const VIEWPORT = { width: window.innerWidth, height: window.innerHeight };

afterEach(async () => {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  for (const fn of Object.values(api)) {
    fn.mockReset();
  }
  resetWailsMock();
});

describe.each(THEMES)("The welcome, the scenes in the %s theme", (theme) => {
  it.each(CASES)(
    "draws the welcome, moment '%s', at the main area of %ipx",
    async (variation, width) => {
      setTheme(theme);
      const { state, location, storage, machine } = welcomeScene(variation);
      for (const [key, value] of Object.entries(storage)) {
        localStorage.setItem(key, value);
      }
      if (machine !== undefined) {
        api.checkMachine.mockResolvedValue(machine);
      }
      await page.viewport(windowForMain(width), VIEWPORT.height);
      const { container } = renderWithStore(<AppShell />, { state, ui: { location } });
      await screen.findByRole("heading", { level: 1, name: "Welcome to MySpec" });
      // This machine appears once the check answers, and only when something is missing.
      const missing = machine === undefined ? [] : machineItems(machine);
      if (missing.length > 0) {
        await screen.findByRole("heading", { name: "This machine" });
      } else {
        expect(screen.queryByRole("heading", { name: "This machine" })).not.toBeInTheDocument();
      }
      await settle();
      const shell = container.firstElementChild;
      if (!(shell instanceof HTMLElement)) {
        throw new Error("the window is not drawn");
      }
      const main = screen.getByRole("main");
      const column = main.querySelector<HTMLElement>(".start-column");
      if (column === null) {
        throw new Error("the welcome has no column");
      }

      // Every box of the screen stands on whole pixels, the column centered in the main area included.
      expect(
        offWholePixels(shell.querySelectorAll("aside, main, .start-column, section, li, button")),
      ).toEqual([]);
      expect(main.getBoundingClientRect().width, "the main area").toBe(width);
      expect(edgesOf(column).left - edgesOf(main).left, "the column centered").toBe(
        edgesOf(main).right - edgesOf(column).right,
      );

      // The sidebar is the bare one: no filter, no tree.
      expect(screen.queryByRole("tree")).not.toBeInTheDocument();
      expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
      const history = screen.getByRole("button", { name: /^History/ });
      expect(history.getAttribute("aria-disabled") === "true", "History dashed").toBe(
        variation !== "history",
      );

      // What the screen cuts says its whole text in a tooltip.
      expect(await withoutTooltip(cutTexts(document.body))).toEqual([]);

      // The welcome has no primary.
      expect(visiblePrimaries()).toHaveLength(0);

      await capture(`welcome${variation === "" ? "" : `-${variation}`}-${width}-${theme}`, shell);
    },
  );
});
