import { describe, expect, it, vi } from "vitest";
import { BOARD_SCENES, boardScene, fixBoardSceneClock } from "@/test/board-scenes";
import { capture, setTheme, THEMES } from "@/test/painted";
import {
  atWindow,
  proveScene,
  RAIL_WINDOWS,
  renderShell,
  SWEEP_TIMEOUT,
  windowsIn,
} from "@/test/widths";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

// A scene rests the pointer on every text it cuts, one by one.
vi.setConfig({ testTimeout: SWEEP_TIMEOUT });

/** REFERENCE are the scenes whose captures go to the pull request. */
const REFERENCE = ["board", "card", "home"];

/** RAIL are the scenes drawn with the sidebar folded into its rail too. */
const RAIL = ["card"];

fixBoardSceneClock();

// draw draws the shell at the place of a scene, and does what the scene has the user do.
async function draw(name: (typeof BOARD_SCENES)[number], rail: boolean) {
  const { state, location, back, storage, after } = boardScene(name);
  for (const [key, value] of Object.entries(storage)) {
    localStorage.setItem(key, value);
  }
  const { main, user } = renderShell({ state, ui: { location, back }, rail });
  await after?.(user);
  return main;
}

describe.each(THEMES)(
  "The board, the Home and the creation in every window, in the %s theme",
  (theme) => {
    describe.each(BOARD_SCENES)("the %s scene", (name) => {
      it.each(windowsIn(theme, { reference: REFERENCE.includes(name) }))(
        "holds the checks of every screen at %ipx",
        async (window) => {
          setTheme(theme);
          await atWindow(window);
          const main = await draw(name, false);

          expect(await proveScene(main)).toEqual({});
          if (REFERENCE.includes(name)) {
            await capture(`ref-${name}-${window}-${theme}`, main);
          }
        },
      );

      if (RAIL.includes(name)) {
        it.each(RAIL_WINDOWS)(
          "holds the checks of every screen at %ipx with the rail",
          async (window) => {
            setTheme(theme);
            await atWindow(window);
            const main = await draw(name, true);

            expect(await proveScene(main)).toEqual({});
            await capture(`ref-${name}-${window}-rail-${theme}`, main);
          },
        );
      }
    });
  },
);
