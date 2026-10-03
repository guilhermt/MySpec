import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { MigrationRefused } from "@/features/migration/MigrationRefused";
import {
  capture,
  cutTexts,
  edgesOf,
  offWholePixels,
  setTheme,
  settle,
  THEMES,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { fixSettingsSceneClock, migrationScene } from "@/test/settings-scenes";

/** WIDE and HALF are the widths of the window the screen is drawn at: it takes the whole window. */
const WIDE = 2560;
const HALF = 1250;

fixSettingsSceneClock();

const VIEWPORT = { width: window.innerWidth, height: window.innerHeight };

afterEach(async () => {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
});

describe.each(THEMES)("The refused migration, the scene in the %s theme", (theme) => {
  it.each([WIDE, HALF])("draws the migration at the window of %ipx", async (width) => {
    setTheme(theme);
    const { state } = migrationScene();
    if (state.migration === null) {
      throw new Error("the scene has no migration");
    }
    await page.viewport(width, VIEWPORT.height);
    const { container } = renderWithStore(<MigrationRefused migration={state.migration} />, {
      state,
    });
    await settle();
    const main = screen.getByRole("main");
    const column = main.firstElementChild;
    if (!(column instanceof HTMLElement)) {
      throw new Error("the migration has no column");
    }

    // Every box of the screen stands on whole pixels, the column centered in the window included.
    expect(offWholePixels([main, column, ...main.querySelectorAll("section, li, button")])).toEqual(
      [],
    );
    expect(edgesOf(column).left - edgesOf(main).left, "the column centered").toBe(
      edgesOf(main).right - edgesOf(column).right,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    // What the screen cuts says its whole text in a tooltip.
    expect(await withoutTooltip(cutTexts(document.body))).toEqual([]);

    // The migration has no primary: Copy the list is secondary.
    expect(visiblePrimaries()).toHaveLength(0);

    const area = container.firstElementChild;
    if (!(area instanceof HTMLElement)) {
      throw new Error("the window is not drawn");
    }
    await capture(`migration-${width}-${theme}`, area);
  });
});
