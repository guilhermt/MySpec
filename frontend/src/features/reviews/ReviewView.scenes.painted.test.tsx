import { within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoneView } from "@/features/navigation/GoneView";
import { ReviewView } from "@/features/reviews/ReviewView";
import {
  capture,
  cutTexts,
  mainArea,
  NARROW_MAIN,
  offWholePixels,
  overlaps,
  placeHeaderOneLine,
  placeHeaderPieces,
  setTheme,
  settle,
  stepperText,
  THEMES,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import {
  fixReviewSceneClock,
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

/** Case is a scene of the review with its flags, named as the mock's query names it: "publish?own". */
type Case = { name: ReviewSceneName; flags: ReviewFlags; label: string };

const scene = (name: ReviewSceneName, flags: ReviewFlags = {}): Case => {
  const on = Object.keys(flags);
  return { name, flags, label: on.length === 0 ? name : `${name}?${on.join("&")}` };
};

const CASES: Case[] = [
  scene("checks"),
  scene("pass"),
  scene("findings"),
  scene("publish"),
  scene("clean"),
  scene("again"),
  scene("merged"),
  scene("publish", { own: true }),
  scene("clean", { own: true }),
  scene("publish", { stale: true }),
  scene("findings", { apply: true }),
  scene("publish", { apply: true }),
  scene("findings", { checkerr: true }),
];

// widthsOf are the main areas a scene is drawn at; the findings at the narrowest one too.
const widthsOf = ({ name, flags }: Case) => [
  WIDE_MAIN,
  HALF_MAIN,
  ...(name === "findings" && Object.keys(flags).length === 0 ? [NARROW_MAIN] : []),
];

/** WORDS are what the pill says beside the pass while no bar says it, by scene. */
const WORDS: Partial<Record<ReviewSceneName, string>> = { checks: "checks 4/6", pass: "working" };

/** PILL_LIMIT is the main area under which the pill keeps its glyph and loses its word. */
const PILL_LIMIT = 1040;

// draw draws the screen of a scene in a main area of a width: the review, or the page of the review
// that left; and does what the scene has the user do.
async function draw(sceneOf: ReviewScene, width: number) {
  const { location } = sceneOf;
  const view =
    location.kind === "gone" ? (
      <GoneView location={location} />
    ) : location.kind === "review" ? (
      <ReviewView reviewId={location.id} />
    ) : null;
  if (view === null) {
    throw new Error("the scene is not a review");
  }
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>{view}</div>,
    { state: sceneOf.state, ui: { location, transcripts: sceneOf.transcripts } },
  );
  await sceneOf.after?.(user);
  await settle();
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  // A modal dialog hides the screen under it from the tree the roles read.
  return { area, band: within(area).getByRole("banner", { hidden: true }) };
}

// dialog is the dialog open over the screen, null when none is.
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

/**
 * parts are what the screen draws in a box of its own, that must stand on whole pixels: the card of
 * findings and each finding, the bar of the request, the composer, the strip, the page of the review
 * that left, the panels and the dialog.
 */
function parts(area: HTMLElement): Element[] {
  const open = dialog();
  return [
    ...area.querySelectorAll("[data-decision-card], [data-finding-id]"),
    ...area.querySelectorAll('section[aria-label="Request"], [data-slot="composer"]'),
    ...area.querySelectorAll('[role="alert"], [role="status"], aside, article'),
    ...(open === null ? [] : [open]),
  ];
}

describe.each(THEMES)("ReviewView, the scenes in the %s theme", (theme) => {
  describe.each(CASES)("the $label scene", (one) => {
    const drawn = reviewScene(one.name, one.flags);
    fixReviewSceneClock(drawn);

    it.each(widthsOf(one))("draws it at the main area of %ipx", async (width) => {
      setTheme(theme);
      const { area, band } = await draw(drawn, width);

      // The header keeps one line, and nothing on it covers anything else.
      expect(placeHeaderOneLine(band)).toBe(true);
      expect(overlaps(placeHeaderPieces(band))).toBe(false);

      // Every box of the screen stands on whole pixels.
      expect(offWholePixels(parts(area))).toEqual([]);

      // The pill of the pass says its word only where the band has room for it.
      if (one.name !== "merged") {
        const stepper = within(band).getByRole("list", { name: /^Progress/, hidden: true });
        const word = WORDS[one.name] ?? "";
        const shown = width >= PILL_LIMIT && word !== "" ? `Pass 1 ${word}` : "Pass 1";
        expect(stepperText(stepper)).toBe(shown);
      }

      // What the screen cuts says its whole text in a tooltip.
      const open = dialog();
      const cut = [...cutTexts(area), ...(open === null ? [] : cutTexts(open))];
      expect(await withoutTooltip(cut)).toEqual([]);

      // The top layer has one primary at most: the dialog when one is open, else the screen.
      expect(visiblePrimaries(open ?? document).length).toBeLessThanOrEqual(1);

      await capture(`review-${one.label.replace("?", "-")}-${width}-${theme}`, area);
    });
  });
});
