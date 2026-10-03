import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { StartScreen } from "@/features/startup/StartScreen";
import {
  capture,
  cutTexts,
  edgesOf,
  offWholePixels,
  resolve,
  setTheme,
  settle,
  THEMES,
  visiblePrimaries,
  windowForMain,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { fixSettingsSceneClock, START_VARIATIONS, startScene } from "@/test/settings-scenes";
import { api, resetWailsMock } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** WIDE_MAIN is the main area of a 2560px window; HALF_MAIN the one of half a monitor. */
const WIDE_MAIN = 2180;
const HALF_MAIN = 978;

const CASES = START_VARIATIONS.flatMap((variation) =>
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

describe.each(THEMES)("The start, the scenes in the %s theme", (theme) => {
  it.each(CASES)(
    "draws the start, moment '%s', at the main area of %ipx",
    async (variation, width) => {
      setTheme(theme);
      const { startup, storage } = startScene(variation);
      for (const [key, value] of Object.entries(storage)) {
        localStorage.setItem(key, value);
      }
      await page.viewport(windowForMain(width), VIEWPORT.height);
      const failed = variation === "failed" || variation === "disk-full";
      const { container } = renderWithStore(<StartScreen />, { startup: startup ?? null });
      // The main area waits 400 ms for a start that is quick; a failure shows at once.
      if (failed) {
        await screen.findByRole("alert");
      } else {
        await screen.findByRole("heading", { name: "Starting MySpec…" });
      }
      await settle();
      const window_ = container.firstElementChild;
      if (!(window_ instanceof HTMLElement)) {
        throw new Error("the window is not drawn");
      }
      const main = screen.getByRole("main");
      const column = main.querySelector<HTMLElement>(".start-column");
      if (column === null) {
        throw new Error("the start has no column");
      }

      // Every box of the screen stands on whole pixels, the column centered in the main area included.
      expect(
        offWholePixels(
          window_.querySelectorAll(
            "aside, main, .start-column, [role='status'], [role='alert'], li",
          ),
        ),
      ).toEqual([]);
      expect(main.getBoundingClientRect().width, "the main area").toBe(width);
      expect(edgesOf(column).left - edgesOf(main).left, "the column centered").toBe(
        edgesOf(main).right - edgesOf(column).right,
      );

      // The sidebar is the skeleton, shimmering while it runs and still on the failure.
      const sidebar = screen.getByRole("complementary", { name: "Work" });
      expect(sidebar).toHaveAttribute("aria-busy", failed ? "false" : "true");

      // What the screen cuts says its whole text in a tooltip.
      expect(await withoutTooltip(cutTexts(document.body))).toEqual([]);

      // A step's label is whole on its line: a long path is what gives way.
      for (const item of main.querySelectorAll("li")) {
        const label = item.children[1];
        if (label instanceof HTMLElement) {
          expect(label.getBoundingClientRect().height, `${label.textContent} on one line`).toBe(
            parseFloat(resolve("var(--leading-ui)", "height")),
          );
          expect(cutTexts(item), `${label.textContent} whole`).not.toContain(label);
        }
      }
      if (variation === "slow-long") {
        expect(cutTexts(main).map((element) => element.textContent)).toContain(
          "/mnt/team-share/engineering/platform/infrastructure/terraform-modules doesn't answer",
        );
      }

      // The start has a primary only when it failed: Try again.
      expect(visiblePrimaries()).toHaveLength(failed ? 1 : 0);

      await capture(`start${variation === "" ? "" : `-${variation}`}-${width}-${theme}`, window_);
    },
  );
});
