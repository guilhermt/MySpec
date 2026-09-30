import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { NewTaskDialog } from "@/features/task-create/NewTaskDialog";
import { type BoardSceneName, boardScene, fixBoardSceneClock } from "@/test/board-scenes";
import {
  capture,
  cutTexts,
  offWholePixels,
  resolve,
  setTheme,
  settle,
  THEMES,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** WIDE_WINDOW and HALF_WINDOW are the widths of the main areas the scenes are drawn at, as windows. */
const WIDE_WINDOW = 2180;
const HALF_WINDOW = 978;

const SCENES = ["create", "create-card"] as const satisfies readonly BoardSceneName[];

fixBoardSceneClock();

afterEach(async () => {
  await page.viewport(1280, 800);
});

// draw opens the dialog of a scene in a window of a width.
async function draw(name: (typeof SCENES)[number], width: number): Promise<HTMLElement> {
  await page.viewport(width, 800);
  const { state, location, back, after } = boardScene(name);
  const { user } = renderWithStore(<NewTaskDialog />, { state, ui: { location, back } });
  await after?.(user);
  await settle();
  return await screen.findByRole("dialog", { name: "New task" });
}

describe.each(THEMES)("NewTaskDialog, the scenes in the %s theme", (theme) => {
  it.each(
    SCENES.flatMap((name) => [WIDE_WINDOW, HALF_WINDOW].map((width) => [name, width] as const)),
  )("draws the %s scene in a window of %ipx", async (name, width) => {
    setTheme(theme);
    const dialog = await draw(name, width);

    // The dialog, its footer and its fields stand on whole pixels, and it is --size-dialog-wide wide.
    expect(offWholePixels([dialog, ...dialog.querySelectorAll("input, textarea, button")])).toEqual(
      [],
    );
    expect(dialog.getBoundingClientRect().width).toBe(
      parseFloat(resolve("var(--size-dialog-wide)", "width")),
    );

    // What the dialog cuts says its whole text in a tooltip.
    expect(await withoutTooltip(cutTexts(dialog))).toEqual([]);

    // Create is the one primary.
    expect(visiblePrimaries()).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name: /^Create/ })).toHaveAttribute(
      "data-variant",
      "primary",
    );

    await capture(`${name}-${width}-${theme}`, dialog);
  });
});
