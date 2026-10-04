import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { AppShell } from "@/app/AppShell";
import { ArchivedDiscussion } from "@/features/history/ArchivedDiscussion";
import { ArchivedReview } from "@/features/history/ArchivedReview";
import { ArchivedTask } from "@/features/history/ArchivedTask";
import {
  fixHistorySceneClock,
  HISTORY_VARIANTS,
  type HistorySceneName,
  historyScene,
} from "@/test/history-scenes";
import {
  capture,
  centeredInWindow,
  cutTexts,
  footerPlaces,
  mainArea,
  offWholePixels,
  overlaps,
  placeHeaderOneLine,
  placeHeaderPieces,
  resolve,
  setTheme,
  settle,
  THEMES,
  visiblePrimaries,
  windowForMain,
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
const WIDTHS = [WIDE_MAIN, HALF_MAIN];

const SCENES = (["archived-task", "archived-review", "archived-discussion"] as const).flatMap(
  (name) => HISTORY_VARIANTS[name].map((variant) => ({ name, variant })),
);

// viewOf is the screen of an archived item the scene is about.
function viewOf(name: HistorySceneName, id: string) {
  switch (name) {
    case "archived-task":
      return <ArchivedTask taskId={id} />;
    case "archived-review":
      return <ArchivedReview reviewId={id} />;
    default:
      return <ArchivedDiscussion discussionId={id} />;
  }
}

const VIEWPORT = { width: window.innerWidth, height: window.innerHeight };

afterEach(async () => {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
});

// draw draws the screen of an archived item in a main area of a width, and does what the scene has
// the user do. A scene with a dialog draws the whole window, the sidebar beside the area, so the
// dialog centers over the window as it does in the app; the capture then takes the window.
async function draw(name: HistorySceneName, variant: string, width: number) {
  const scene = historyScene(name, variant);
  const { location, back } = scene;
  if (
    location.kind !== "archived-task" &&
    location.kind !== "archived-review" &&
    location.kind !== "archived-discussion"
  ) {
    throw new Error("the scene is not an archived item");
  }
  const windowed = variant === "delete";
  if (windowed) {
    await page.viewport(windowForMain(width), VIEWPORT.height);
  }
  const { container, user } = renderWithStore(
    windowed ? (
      <AppShell />
    ) : (
      <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>
        {viewOf(name, location.id)}
      </div>
    ),
    { state: scene.state, ui: { location, back } },
  );
  // The documents, the transcript and the reports are read before the screen is drawn.
  await vi.waitFor(() => {
    if (container.querySelector('[aria-busy="true"], [aria-label^="Reading "]') !== null) {
      throw new Error("the screen is still reading");
    }
  });
  await scene.after?.(user);
  await settle();
  const frame = container.firstElementChild;
  if (!(frame instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  const area = windowed ? screen.getByRole("main", { hidden: true }) : frame;
  expect(area.getBoundingClientRect().width).toBe(width);
  return { area, frame, band: within(area).getByRole("banner", { hidden: true }), user };
}

// TAG_TEXT is what the tags of an archived item can say.
const TAG_TEXT = /^(Archived|One-Shot|Merged|Closed)+$/;

/**
 * headerLine is the header of an archived item from left to right, as boxes: the glyph of the kind,
 * the title and the tags, then on the right the link and the ⋯.
 */
function headerLine(band: HTMLElement) {
  const title = band.querySelector("h1");
  const glyph = title?.previousElementSibling;
  const tags = title?.nextElementSibling;
  const right = band.lastElementChild;
  if (!title || !glyph || !tags || !right || tags === right) {
    throw new Error("the header lacks the glyph, the tags or the right side");
  }
  return { title, glyph, tags, right };
}

// dialog is the dialog open over the screen, null when none is.
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');

// parts are what the screen draws in a box of its own, that must stand on whole pixels: the body of
// the page and what it holds, the tabs and their panel, each line and block, the dialog.
function parts(area: HTMLElement, band: HTMLElement): Element[] {
  const body = band.nextElementSibling;
  const open = dialog();
  return [
    ...(body === null ? [] : [body, ...body.children, ...body.querySelectorAll(":scope > * > *")]),
    ...area.querySelectorAll('[role="tablist"], [role="tabpanel"], article, section, dl, ul, li'),
    ...(open === null ? [] : [open]),
  ];
}

describe.each(THEMES)("The archived items, the scenes in the %s theme", (theme) => {
  describe.each(SCENES)("the $name scene, variant “$variant”", ({ name, variant }) => {
    fixHistorySceneClock(historyScene(name, variant));

    it.each(WIDTHS)("draws it at the main area of %ipx", async (width) => {
      setTheme(theme);
      const { area, frame, band, user } = await draw(name, variant, width);

      // The header keeps one line, and nothing on it covers anything else.
      expect(placeHeaderOneLine(band)).toBe(true);
      expect(overlaps(placeHeaderPieces(band))).toBe(false);
      // ← has a place behind it, as it has in the app.
      expect(
        within(band).getByRole("button", { name: /^Back to /, hidden: true }),
      ).not.toHaveAttribute("aria-disabled", "true");

      // Every box of the screen stands on whole pixels.
      expect(offWholePixels(parts(area, band))).toEqual([]);

      // The glyph of the kind, the title and the tags read together on the left; the link and the ⋯
      // stand on the right.
      const { title, glyph, tags, right } = headerLine(band);
      expect(glyph.matches("nav, button") || glyph.querySelector("button") !== null).toBe(false);
      expect(glyph.querySelector("svg")).not.toBeNull();
      expect(tags.textContent).toMatch(TAG_TEXT);
      expect(
        within(right as HTMLElement).getByRole("button", { name: "More actions", hidden: true }),
      ).toBeVisible();
      const boxes = [glyph, title, tags, right].map((element) => element.getBoundingClientRect());
      for (const [before, after] of boxes.slice(0, -1).map((box, i) => [box, boxes[i + 1]])) {
        expect(after?.left).toBeGreaterThanOrEqual(before?.right ?? Number.POSITIVE_INFINITY);
      }
      expect(tags.getBoundingClientRect().left - title.getBoundingClientRect().right).toBe(
        parseFloat(resolve("var(--space-2)", "width")),
      );

      // A document read in a tab has its headings at the size of the UI, under the title of the place.
      const headings = area.querySelectorAll<HTMLElement>(
        '[role="tabpanel"] [data-streamdown^="heading-"]',
      );
      if (name === "archived-task" && (variant === "" || variant === "oneshot")) {
        expect(headings.length).toBeGreaterThan(0);
      }
      for (const heading of headings) {
        const style = getComputedStyle(heading);
        expect([style.fontSize, style.fontWeight]).toEqual([
          resolve("var(--text-ui)", "font-size"),
          "600",
        ]);
      }

      // The dialog opens 8vh from the top on a whole pixel, with Cancel and the confirmation on one
      // line, the confirmation at the right of it.
      const open = dialog();
      if (open !== null) {
        expect(open.getBoundingClientRect().top).toBe(
          parseFloat(resolve("round(8vh, 1px)", "top")),
        );
        expect(centeredInWindow(open, area)).toBe(true);
        const { cancel, primary } = footerPlaces(open, /^Delete /);
        expect(cancel.top).toBe(primary.top);
        expect(primary.right).toBeLessThan(cancel.right);
      }

      // The capture comes before the pointer passes over what is cut, which scrolls to it.
      if (document.querySelector('[role="tooltip"]') !== null) {
        (document.activeElement as HTMLElement | null)?.blur();
        await vi.waitFor(() => {
          if (document.querySelector('[role="tooltip"]') !== null) {
            throw new Error("a tooltip is open");
          }
        });
      }
      await capture(
        `history-${name}${variant === "" ? "" : `-${variant}`}-${width}-${theme}`,
        frame,
      );

      // What the top layer cuts says its whole text in a tooltip. A modal dialog takes the pointer
      // from the screen under it, which the same scene without the dialog checks.
      expect(await withoutTooltip(cutTexts(open ?? area))).toEqual([]);

      // An archived item has no primary, and the confirmation of a deletion is dangerous, not primary.
      expect(visiblePrimaries(open ?? document)).toEqual([]);

      // The ⋯ opens a menu with one item, Delete….
      if (open === null && variant === "") {
        await user.click(within(area).getByRole("button", { name: "More actions" }));
        const items = await within(document.body).findAllByRole("menuitem");
        expect(items.map((item) => item.textContent)).toEqual(["Delete…"]);
        await user.keyboard("{Escape}");
      }
    });
  });

  it("writes what the closing did of the task of the mock, with the base left behind", async () => {
    setTheme(theme);
    const { area } = await draw("archived-task", "", WIDE_MAIN);
    const closing = within(area).getByRole("group", { name: "What the closing did" });
    expect(within(closing).getByText("Worktree removed")).toBeInTheDocument();
    expect(
      within(closing).getByText("dev not updated: another branch is checked out"),
    ).toBeInTheDocument();
  });

  it("folds the 31 messages of the discussion under a line that says they are read only", async () => {
    setTheme(theme);
    const { area } = await draw("archived-discussion", "", WIDE_MAIN);
    await vi.waitFor(() =>
      expect(
        within(area).getByRole("article", { name: /^Conversation · 31 messages/ }),
      ).toBeInTheDocument(),
    );
  });
});
