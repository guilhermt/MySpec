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
      const shortcuts = within(area).getByRole("group", { name: "Shortcuts", hidden: true });
      expect(shortcuts.getBoundingClientRect().right).toBeLessThanOrEqual(
        column.getBoundingClientRect().right,
      );

      // The name of Continue, the one title that gives way, is whole or keeps at least a third of
      // its row; the label of a row of Start or Boards never gives way, and the keys of each fit in the row.
      for (const button of column.querySelectorAll("button")) {
        const title = button.querySelector("span.truncate.font-semibold");
        if (title !== null && title.scrollWidth > title.clientWidth) {
          expect(title.getBoundingClientRect().width).toBeGreaterThanOrEqual(
            button.getBoundingClientRect().width / 3,
          );
        }
        const label = button.querySelector(":scope > span.font-medium");
        if (label !== null) {
          expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
        }
        for (const keys of button.querySelectorAll("kbd")) {
          expect(keys.scrollWidth).toBeLessThanOrEqual(keys.clientWidth);
          expect(keys.getBoundingClientRect().right).toBeLessThanOrEqual(
            button.getBoundingClientRect().right,
          );
        }
      }
      for (const keys of column.querySelectorAll('span[aria-hidden="true"]')) {
        expect(keys.scrollWidth).toBeLessThanOrEqual(keys.clientWidth);
      }

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

  it("writes the age of the reading of a board in the meta size, the failed one too", async () => {
    setTheme(theme);
    const area = await draw("home", WIDE_MAIN);

    const boards = within(area).getByRole("region", { name: "Boards" });
    const ages = within(boards).getAllByText(/^Read(?: failed)? .* ago$/);
    expect(ages.some((age) => age.textContent?.startsWith("Read failed"))).toBe(true);
    for (const age of ages) {
      expect(getComputedStyle(age).fontSize, age.textContent ?? "").toBe(
        resolve("var(--text-meta)", "font-size"),
      );
    }
  });

  it("starts the focus on Continue in the home scene", async () => {
    setTheme(theme);
    const area = await draw("home", HALF_MAIN);

    expect(within(area).getByRole("button", { name: /^Continue: / })).toHaveFocus();
  });

  it("says nothing is in progress in place of Continue in the home-none scene", async () => {
    setTheme(theme);
    const area = await draw("home-none", WIDE_MAIN);

    expect(within(area).queryByRole("button", { name: /^Continue: / })).not.toBeInTheDocument();
    const title = within(area).getByText("Nothing in progress");
    expect(title).toBeVisible();
    // The empty state of a page: the title in --text-ui 600, no bigger than the labels of Start.
    expect(getComputedStyle(title).fontSize).toBe(resolve("var(--text-ui)", "font-size"));
    expect(getComputedStyle(title).fontWeight).toBe("600");
  });
});
