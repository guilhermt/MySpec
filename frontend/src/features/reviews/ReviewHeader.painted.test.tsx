import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewHeader } from "@/features/reviews/ReviewHeader";
import { mainArea, NARROW_MAIN, placeHeaderFits, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeReviewSummary, makeState } from "@/test/wails-mock";

/** LONGEST_TITLE is a pull request title as long as GitHub takes, 256 characters. */
const LONGEST_TITLE = "Rotate the API keys of every service without downtime, "
  .repeat(5)
  .slice(0, 256);

// header draws the header of a review while its pass runs, with every piece the band can hold,
// inside a main area of a fixed width, the container its queries measure.
function header(width: number, title = "Add the login screen") {
  const review = makeReviewSummary({
    title,
    status: "reviewing",
    sessionStatus: "working",
    contextPercent: 72,
  });
  renderWithStore(
    <div style={mainArea(width)}>
      <ReviewHeader review={review} />
    </div>,
    {
      state: makeState({ reviews: [review] }),
      ui: { location: { kind: "review", id: review.id } },
    },
  );
  return screen.getByRole("banner");
}

// shown tells whether an element takes room on screen: a visually hidden one keeps a single pixel,
// a hidden one none.
function shown(element: Element): boolean {
  return element.getBoundingClientRect().width > 1;
}

// pieces finds what each limit of the band gives way.
function pieces() {
  const pill = within(screen.getByRole("list", { name: /^Progress/ })).getByRole("listitem", {
    current: "step",
  });
  const track = screen.getByRole("meter", { name: "Context" }).querySelector("[data-slot='track']");
  if (track === null) {
    throw new Error("the band has no track");
  }
  return {
    levels: within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole("list", {
      hidden: true,
    }),
    panelName: within(screen.getByRole("button", { name: "Details" })).getByText("Details"),
    pauseName: within(screen.getByRole("button", { name: "Pause" })).getByText("Pause"),
    track,
    word: within(pill).getByText("working"),
  };
}

/** LIMITS are the main area widths from which each piece shows, the ones of the header of a task. */
const LIMITS = { levels: 1660, panelName: 1440, pauseName: 1360, track: 1300, word: 1040 } as const;

/** WIDTHS are every limit and the pixel under it. */
const WIDTHS = [...new Set(Object.values(LIMITS))].flatMap((limit) => [limit, limit - 1]);

describe.each(THEMES)("ReviewHeader in the %s theme", (theme) => {
  it.each(WIDTHS)("at %ipx of main area shows each piece from its limit on", (width) => {
    setTheme(theme);
    header(width);
    const found = pieces();

    const seen = Object.fromEntries(
      Object.entries(found).map(([name, element]) => [name, shown(element)]),
    );
    const want = Object.fromEntries(
      Object.entries(LIMITS).map(([name, limit]) => [name, width >= limit]),
    );
    expect(seen).toEqual(want);
  });

  it("keeps everything on one line at 812px of main area, cutting only the title", () => {
    setTheme(theme);
    expect(LONGEST_TITLE).toHaveLength(256);
    expect(placeHeaderFits(header(NARROW_MAIN, LONGEST_TITLE))).toBe(true);
  });
});
