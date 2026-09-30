import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewDiscussionDialog } from "@/features/discussion/NewDiscussionDialog";
import { Home } from "@/features/home/Home";
import { type BoardSceneName, boardScene, fixBoardSceneClock } from "@/test/board-scenes";
import {
  capture,
  cutTexts,
  mainArea,
  offWholePixels,
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

/** WIDE_MAIN is the main area of a 2560px window; HALF_MAIN the one of a 1250px window with the sidebar open. */
const WIDE_MAIN = 2180;
const HALF_MAIN = 978;

const SCENES = ["home", "home-disc", "home-none"] as const satisfies readonly BoardSceneName[];

fixBoardSceneClock();

// draw draws the Home of a scene in a main area of a width, with the dialog the scene opens.
async function draw(name: (typeof SCENES)[number], width: number) {
  const { state, location, back, after } = boardScene(name);
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>
      <Home />
      <NewDiscussionDialog />
    </div>,
    { state, ui: { location, back } },
  );
  await after?.(user);
  await settle();
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  return area;
}

describe.each(THEMES)("Home, the scenes in the %s theme", (theme) => {
  it.each(SCENES.flatMap((name) => [WIDE_MAIN, HALF_MAIN].map((width) => [name, width] as const)))(
    "draws the %s scene at the main area of %ipx",
    async (name, width) => {
      setTheme(theme);
      const area = await draw(name, width);

      // Continue, each row of Start and Boards, the shortcuts and the dialog stand on whole pixels.
      const column = area.querySelector("section section")?.parentElement;
      if (!(column instanceof HTMLElement)) {
        throw new Error("the column of the Home is not drawn");
      }
      expect(
        offWholePixels([
          ...column.querySelectorAll("button"),
          ...column.querySelectorAll('[role="group"]'),
          ...screen.queryAllByRole("dialog"),
        ]),
      ).toEqual([]);

      // The shortcuts stay inside the column.
      const shortcuts = within(area).getByRole("list", { name: "Shortcuts", hidden: true });
      expect(shortcuts.getBoundingClientRect().right).toBeLessThanOrEqual(
        column.getBoundingClientRect().right,
      );

      // What the screen cuts says its whole text in a tooltip.
      expect(await withoutTooltip(cutTexts(area))).toEqual([]);

      // The Home has no primary, and the dialog of the scene one at most.
      expect(visiblePrimaries().length).toBeLessThanOrEqual(1);

      await capture(`${name}-${width}-${theme}`, area);
    },
  );

  it("keeps Continue in a line of its own, whole, in the home scene", async () => {
    setTheme(theme);
    const area = await draw("home", HALF_MAIN);

    const button = within(area).getByRole("button", { name: /^Continue: / });
    expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
  });

  it("says nothing is in progress in place of Continue in the home-none scene", async () => {
    setTheme(theme);
    const area = await draw("home-none", WIDE_MAIN);

    expect(within(area).queryByRole("button", { name: /^Continue: / })).not.toBeInTheDocument();
    expect(within(area).getByText("Nothing in progress")).toBeVisible();
  });
});
