import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { SettingsView } from "@/features/settings/SettingsView";
import {
  capture,
  cutTexts,
  edgesOf,
  mainArea,
  NARROW_MAIN,
  offWholePixels,
  resolve,
  setTheme,
  settle,
  THEMES,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import {
  fixSettingsSceneClock,
  SETTINGS_SCENES,
  SETTINGS_VARIATIONS,
  type SettingsSceneName,
  settingsScene,
} from "@/test/settings-scenes";
import { api, resetWailsMock } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** WIDE_MAIN is the main area of a 2560px window; HALF_MAIN the one of a 1250px window with the sidebar open. */
const WIDE_MAIN = 2180;
const HALF_MAIN = 978;

/** WIDTHS are the main areas each scene is drawn at. */
const WIDTHS = [WIDE_MAIN, HALF_MAIN, NARROW_MAIN];

/** PAGE_WIDTH is the width of the page of Settings in each main area: the measure at the widest, what is left beside the navigation at half a monitor, and what is left of the area when the navigation is a row. */
const PAGE_WIDTH: Record<number, number> = {
  [WIDE_MAIN]: 800,
  [HALF_MAIN]: 674,
  [NARROW_MAIN]: 764,
};

const CASES = SETTINGS_SCENES.flatMap((name) =>
  SETTINGS_VARIATIONS[name].flatMap((variation) =>
    WIDTHS.map((width) => [name, variation, width] as const),
  ),
);

fixSettingsSceneClock();

const VIEWPORT = { width: window.innerWidth, height: window.innerHeight };

afterEach(async () => {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  // The scenes answer the boundary for good; the next one starts from the answers of the mock.
  for (const fn of Object.values(api)) {
    fn.mockReset();
  }
  resetWailsMock();
});

// draw draws Settings in a main area of a width, at a page and a moment, and does what the scene has the user do.
async function draw(name: SettingsSceneName, variation: string, width: number) {
  const { state, location, storage, listings, prompt, after } = settingsScene(name, variation);
  for (const [key, value] of Object.entries(storage)) {
    localStorage.setItem(key, value);
  }
  if (listings instanceof Error) {
    api.listPrompts.mockRejectedValue(listings);
  } else if (listings !== undefined) {
    api.listPrompts.mockResolvedValue(listings);
  }
  if (prompt instanceof Error) {
    api.getPrompt.mockRejectedValue(prompt);
  } else if (prompt !== undefined) {
    api.getPrompt.mockResolvedValue(prompt);
  }
  // The window is as wide as the main area, so a dialog centers over it as it would in the app.
  await page.viewport(width, VIEWPORT.height);
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>
      <SettingsView />
    </div>,
    { state, ui: { location } },
  );
  await after?.(user);
  await settle();
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  return area;
}

/** parts are what Settings draws in a box of its own, that must stand on whole pixels: the dialogs are in the body, out of the area. */
function parts(area: HTMLElement): Element[] {
  return [
    ...area.querySelectorAll("nav, aside, fieldset, table, li, [role='alert'], [role='status']"),
    ...area.querySelectorAll(".settings-body > *"),
    ...document.body.querySelectorAll("[role='dialog'], [role='alertdialog']"),
    ...document.body.querySelectorAll(
      "[role='dialog'] [role='alert'], [role='dialog'] li, [role='dialog'] table, [role='dialog'] tr",
    ),
  ];
}

/** footerSum is the text on the left of a dialog's footer: the sum of what saving does. */
function footerSum(layer: Element | null): string {
  const text = layer?.querySelector("[data-dialog-footer] [id]")?.textContent ?? "";
  if (text === "") {
    throw new Error("the dialog has no sum in its footer");
  }
  return text;
}

describe.each(THEMES)("Settings, the scenes in the %s theme", (theme) => {
  it.each(CASES)(
    "draws the %s scene, moment '%s', at the main area of %ipx",
    async (name, variation, width) => {
      setTheme(theme);
      const area = await draw(name, variation, width);

      // Every box of the screen stands on whole pixels.
      expect(offWholePixels(parts(area))).toEqual([]);

      // The page is as wide as its measure leaves it, and the navigation is beside it or above it.
      const body = area.querySelector<HTMLElement>(".settings-body");
      const nav = area.querySelector("nav");
      const pageBox = body?.children[1];
      if (body === null || nav === null || pageBox === undefined) {
        throw new Error("Settings has no navigation or page");
      }
      expect(pageBox.getBoundingClientRect().width, "the page").toBe(PAGE_WIDTH[width]);
      if (width === NARROW_MAIN) {
        expect(
          nav.getBoundingClientRect().bottom,
          "the navigation above the page",
        ).toBeLessThanOrEqual(pageBox.getBoundingClientRect().top);
        expect(nav.getBoundingClientRect().height, "the navigation as a row").toBeLessThan(
          pageBox.getBoundingClientRect().height,
        );
        const tops = new Set(
          [...nav.querySelectorAll("a")].map((link) => link.getBoundingClientRect().top),
        );
        expect([...tops], "every page of the navigation on one line").toHaveLength(1);
      } else {
        expect(edgesOf(nav).right, "the navigation at the left").toBeLessThanOrEqual(
          edgesOf(pageBox).left,
        );
        // The navigation sticks under the header once the page is scrolled.
        const scroller = body.parentElement as HTMLElement;
        const stuck = scroller.scrollTop > 0;
        expect(nav.getBoundingClientRect().top, "the navigation at the top of the page").toBe(
          stuck
            ? scroller.getBoundingClientRect().top + parseFloat(resolve("var(--space-8)", "width"))
            : pageBox.getBoundingClientRect().top,
        );
      }

      // What the screen cuts says its whole text in a tooltip.
      // Behind a dialog the page can't be reached by the pointer: the dialog is what is checked.
      const layer = document.querySelector("[role='dialog'], [role='alertdialog']");
      expect(await withoutTooltip(cutTexts(layer ?? document.body))).toEqual([]);

      // The board dialog keeps whole what it is there to say: the lead-in of a clone to pick, and
      // the sum of what saving does, on two lines.
      if (name === "settings-boards" && (variation === "add-3" || variation === "edit-2")) {
        const whole = variation === "add-3" ? "Clone found · 2 clones:" : footerSum(layer);
        expect(
          cutTexts(layer ?? document.body).map((element) => element.textContent),
          "the board dialog cuts nothing it is there to say",
        ).not.toContain(whole);
      }

      // The layer on top has one primary at most.
      expect(visiblePrimaries().length).toBeLessThanOrEqual(1);

      // A tooltip the focus left open would cover the screen in the capture: the focus leaves first.
      if (document.querySelector('[role="tooltip"]') !== null) {
        (document.activeElement as HTMLElement | null)?.blur();
        await vi.waitFor(() => {
          if (document.querySelector('[role="tooltip"]') !== null)
            throw new Error("a tooltip is open");
        });
      }

      await capture(`${name}${variation === "" ? "" : `-${variation}`}-${width}-${theme}`, area);
    },
  );
});
