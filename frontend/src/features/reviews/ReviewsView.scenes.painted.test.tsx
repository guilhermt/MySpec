import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewsView } from "@/features/reviews/ReviewsView";
import { StartReviewDialog } from "@/features/reviews/StartReviewDialog";
import { reviewRow } from "@/features/sidebar/sidebar-tree";
import { REVIEWS_SECTIONS_KEY } from "@/lib/ui-storage";
import type { State } from "@/lib/wails";
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
  spillsOut,
  THEMES,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import {
  fixReviewSceneClock,
  IOS_REVIEW_ID,
  type ReviewFlags,
  type ReviewScene,
  type ReviewSceneName,
  reviewScene,
} from "@/test/review-scenes";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** WIDE_MAIN is the main area of a 2560px window; HALF_MAIN the one of a 1250px window with the sidebar open. */
const WIDE_MAIN = 2180;
const HALF_MAIN = 978;

/** PANEL_MAIN are the main areas the panel of api#1302 is proved at: beside the list, and over it. */
const PANEL_MAIN = [NARROW_MAIN, 790];

/** Case is a scene of Reviews with its flags, named as the mock's query names it: "start?own". */
type Case = { name: ReviewSceneName; flags: ReviewFlags; label: string };

const CASES: Case[] = [
  { name: "list", flags: {}, label: "list" },
  { name: "list-empty", flags: {}, label: "list-empty" },
  { name: "list-failed", flags: {}, label: "list-failed" },
  { name: "start", flags: {}, label: "start" },
  { name: "start", flags: { own: true }, label: "start?own" },
];

// widthsOf are the main areas a scene is drawn at; the list with its panel at the narrow ones too.
const widthsOf = (name: ReviewSceneName) => [
  WIDE_MAIN,
  HALF_MAIN,
  ...(name === "list" ? PANEL_MAIN : []),
];

// px is a length token in pixels.
const px = (name: `--${string}`) => parseFloat(resolve(`var(${name})`, "width"));

// draw draws Reviews of a scene in a main area of a width, with the dialog that starts a review, and
// does what the scene has the user do unless told not to.
async function draw(scene: ReviewScene, width: number, { after = true } = {}) {
  for (const [key, value] of Object.entries(scene.storage)) {
    localStorage.setItem(key, value);
  }
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>
      <ReviewsView />
      <StartReviewDialog />
    </div>,
    { state: scene.state, ui: { location: scene.location, transcripts: scene.transcripts } },
  );
  if (after) {
    await scene.after?.(user);
  }
  await settle();
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  return { area, user };
}

// rowOf is the row of a pull request of the list, by its reference.
const rowOf = (reference: string) =>
  screen.getByRole("treeitem", { name: new RegExp(`^${reference} `) });

// piecesOf are the column of the title, the title itself, its tags, the second line and the keys of a
// row: the column is its second child, with the title first and the tags after it, the second line
// its third child and the keys its last.
function piecesOf(row: HTMLElement) {
  const [, column, meta] = row.children;
  const title = column?.firstElementChild;
  const keys = row.lastElementChild;
  if (
    !(column instanceof HTMLElement) ||
    !(title instanceof HTMLElement) ||
    !(meta instanceof HTMLElement) ||
    !(keys instanceof HTMLElement)
  ) {
    throw new Error(`${row.getAttribute("aria-label")} has no title, second line or keys`);
  }
  const tags = [...(title.nextElementSibling?.children ?? [])].map((tag) => tag.textContent);
  return { column, title, tags, meta, keys };
}

// leastTitle is the least room the title of a row takes: its whole text, or a third of the row when
// the text is longer than that.
const leastTitle = (row: HTMLElement, title: HTMLElement) =>
  Math.min(title.scrollWidth, row.getBoundingClientRect().width / 3);

// dialog is the dialog open over the screen, null when none is.
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

/** parts are what the screen draws in a box of its own, that must stand on whole pixels. */
function parts(area: HTMLElement): Element[] {
  const open = dialog();
  return [
    ...area.querySelectorAll("[data-row-key], [data-section-id]"),
    ...area.querySelectorAll('[role="search"], [role="alert"], aside'),
    ...(open === null ? [] : [open]),
  ];
}

// withTestRow is the list with ios#312 by dependabot: its review, Published · changes requested,
// takes 287px beside the author at the narrowest list, more than the second line holds.
function withTestRow(scene: ReviewScene): ReviewScene {
  const center = scene.state.reviewCenter;
  const state: State = {
    ...scene.state,
    reviews: (scene.state.reviews ?? []).map((review) =>
      review.id === IOS_REVIEW_ID ? { ...review, author: "dependabot" } : review,
    ),
    reviewCenter: {
      ...center,
      pullRequests: (center.pullRequests ?? []).map((row) =>
        row.reviewId === IOS_REVIEW_ID ? { ...row, author: "dependabot" } : row,
      ),
    },
  };
  return { ...scene, state };
}

// expanded is the scene with every section of the list expanded, so a proof measures every row of it:
// the scene starts with Reviewed and Yours and your tasks collapsed.
function expanded(scene: ReviewScene): ReviewScene {
  return {
    ...scene,
    storage: { ...scene.storage, [REVIEWS_SECTIONS_KEY]: JSON.stringify({ collapsed: [] }) },
  };
}

// rowsOf are the rows of the list drawn, every pull request of the scene's reading.
function rowsOf(area: HTMLElement, scene: ReviewScene): HTMLElement[] {
  const rows = [...area.querySelectorAll<HTMLElement>("[data-row-key]")];
  expect(rows.length).toBe((scene.state.reviewCenter.pullRequests ?? []).length);
  return rows;
}

// shownText is what a cell shows, without the invisible copy a review keeps to measure its long form.
function shownText(cell: Element): string {
  return [cell, ...cell.querySelectorAll("span")]
    .filter((span) => span.children.length === 0 && getComputedStyle(span).visibility !== "hidden")
    .map((span) => span.textContent)
    .join("");
}

describe.each(THEMES)("ReviewsView, the scenes in the %s theme", (theme) => {
  describe.each(CASES)("the $label scene", ({ name, flags, label }) => {
    const scene = reviewScene(name, flags);
    fixReviewSceneClock(scene);

    it.each(widthsOf(name))("draws it at the main area of %ipx", async (width) => {
      setTheme(theme);
      const { area } = await draw(scene, width);

      // Every box of the screen stands on whole pixels.
      expect(offWholePixels(parts(area))).toEqual([]);

      // A title is whole or never squeezed under a third of its row, its tags are never cut, and the
      // keys keep their column.
      for (const row of area.querySelectorAll<HTMLElement>("[data-row-key]")) {
        const { column, title, keys } = piecesOf(row);
        const reference = row.getAttribute("aria-label") ?? "";
        expect(title.getBoundingClientRect().width, `${reference} title`).toBeGreaterThanOrEqual(
          leastTitle(row, title),
        );
        expect(spillsOut(column), `${reference} tags`).toBe(false);
        expect(keys.getBoundingClientRect().width, `${reference} keys`).toBe(px("--col-keys"));
        expect(spillsOut(keys), `${reference} keys`).toBe(false);
      }

      // What the screen cuts says its whole text in a tooltip.
      const open = dialog();
      const cut = [...cutTexts(area), ...(open === null ? [] : cutTexts(open))];
      expect(await withoutTooltip(cut)).toEqual([]);

      // The top layer has one primary at most: the dialog when one is open, else the screen.
      expect(visiblePrimaries(open ?? document).length).toBeLessThanOrEqual(1);

      await capture(`reviews-${label.replace("?", "-")}-${width}-${theme}`, area);
    });
  });

  describe("the widths of the list", () => {
    const scene = expanded(reviewScene("list"));
    // The browser keeps localStorage between the tests: the scenes after these start collapsed again.
    afterEach(() => localStorage.removeItem(REVIEWS_SECTIONS_KEY));
    fixReviewSceneClock(scene);

    it.each([
      [1041, false],
      [1040, true],
    ])("draws a row at a list of %ipx with a second line: %s", async (width, second) => {
      setTheme(theme);
      const { area } = await draw(scene, width, { after: false });

      const list = area.querySelector<HTMLElement>(".list-area");
      expect(list?.getBoundingClientRect().width).toBe(width);
      for (const row of rowsOf(area, scene)) {
        const label = row.getAttribute("aria-label") ?? "";
        expect(
          row.getBoundingClientRect().height > px("--size-control"),
          `${label} on two lines`,
        ).toBe(second);
        if (!second) {
          expect(piecesOf(row).column.getBoundingClientRect().width, label).toBe(425);
        }
      }
    });

    it("keeps the author and the state of every row whole beside the panel at 812px", async () => {
      setTheme(theme);
      const { area } = await draw(scene, NARROW_MAIN);

      const list = area.querySelector<HTMLElement>(".list-area");
      expect(list?.getBoundingClientRect().width).toBe(452);
      expect(edgesOf(screen.getByRole("complementary")).left).toBe(edgesOf(list as Element).right);
      for (const row of rowsOf(area, scene)) {
        const label = row.getAttribute("aria-label") ?? "";
        const { column, meta } = piecesOf(row);
        const line = meta.getBoundingClientRect();
        expect(column.getBoundingClientRect().width, `${label} title`).toBe(156);
        expect(line.width, `${label} second line`).toBe(284);
        expect(line.top, `${label} second line`).toBeGreaterThanOrEqual(
          column.getBoundingClientRect().bottom,
        );
        // The author and the state sit whole inside the second line, nothing of them cut.
        for (const cell of meta.children) {
          const box = cell.getBoundingClientRect();
          expect(
            box.left >= line.left && box.right <= line.right,
            `${label}: ${cell.textContent} inside the second line`,
          ).toBe(true);
        }
        expect(cutTexts(meta).map((cut) => cut.textContent)).toEqual([]);
      }
    });

    // The long form, 287px beside dependabot, passes the 284px of the second line. Published has no
    // shorter form (docs/design/structure.md: the tree says the same), so the short one cuts, with the tooltip.
    it("gives the state that doesn't fit beside dependabot at 812px its short form, cut with a tooltip", async () => {
      setTheme(theme);
      const test = withTestRow(scene);
      await draw(test, NARROW_MAIN);

      const review = (test.state.reviews ?? []).find((one) => one.id === IOS_REVIEW_ID);
      if (review === undefined) {
        throw new Error("the scene has no review of ios#312");
      }
      const { long, short } = reviewRow(review, Date.now()).line2;
      const { meta } = piecesOf(rowOf("ios#312"));
      const [author, state] = meta.children;
      if (!(author instanceof HTMLElement) || !(state instanceof HTMLElement)) {
        throw new Error("ios#312 has no author or state");
      }
      expect(long).toBe("Published · changes requested");
      expect(author.getBoundingClientRect().width + px("--space-4") + state.scrollWidth).toBe(287);
      expect(shownText(author)).toBe("dependabot");
      expect(cutTexts(author)).toEqual([]);
      expect(shownText(state)).toBe(short);
      const cut = cutTexts(state);
      expect(cut.map((one) => one.textContent)).toEqual([short]);
      expect(await withoutTooltip(cut)).toEqual([]);
    });

    // api#1298 by dependabot has two labels: dependabot, which repeats the author, and dependencies.
    // Before its title would go under a third of the row, they fold into +2, and then go.
    it.each([
      [WIDE_MAIN, ["dependencies", "+1"]],
      [HALF_MAIN, ["+2"]],
      [NARROW_MAIN, []],
    ])(
      "gives the labels of api#1298 way before its title, at the main area of %ipx",
      async (width, shown) => {
        setTheme(theme);
        await draw(scene, width);

        const row = rowOf("api#1298");
        const { column, title, tags } = piecesOf(row);
        expect(tags).toEqual(shown);
        // The title is whole beside the tags at the wide area, and keeps a third of the row, cut, at
        // the narrow ones.
        const cut = cutTexts(column).includes(title);
        expect(cut).toBe(width !== WIDE_MAIN);
        expect(title.getBoundingClientRect().width).toBeGreaterThanOrEqual(
          cut ? row.getBoundingClientRect().width / 3 : title.scrollWidth,
        );
        expect(spillsOut(column)).toBe(false);
        const folded = [...column.querySelectorAll<HTMLElement>("span")].filter(
          (tag) => tag.textContent === "+2",
        );
        expect(await withoutTooltip(folded)).toEqual([]);
      },
    );

    it("covers the list with the panel at 790px", async () => {
      setTheme(theme);
      const { area } = await draw(scene, 790);

      const list = area.querySelector<HTMLElement>(".list-area");
      const panel = screen.getByRole("complementary").getBoundingClientRect();
      const box = (list as Element).getBoundingClientRect();
      expect(box.width).toBe(790);
      expect(panel.left).toBeLessThan(box.right);
    });
  });
});
