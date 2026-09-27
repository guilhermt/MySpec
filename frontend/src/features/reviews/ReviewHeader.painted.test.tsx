import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewHeader } from "@/features/reviews/ReviewHeader";
import { mainArea, NARROW_MAIN, placeHeaderFits, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeReviewSummary, makeState } from "@/test/wails-mock";

/** LONGEST_TITLE is a pull request title as long as GitHub takes, 256 characters. */
const LONGEST_TITLE = "Rotate the API keys of every service without downtime, "
  .repeat(5)
  .slice(0, 256);

describe.each(THEMES)("ReviewHeader in the %s theme", (theme) => {
  it("keeps everything on one line at 812px of main area, cutting only the title", () => {
    setTheme(theme);
    const review = makeReviewSummary({
      title: LONGEST_TITLE,
      status: "awaiting_reply",
      sessionStatus: "working",
      contextPercent: 72,
      card: {
        boardId: "board-1",
        number: 12,
        title: "Rotate the API keys",
        url: "https://github.com/dev/web/issues/12",
        status: "In review",
      },
    });
    renderWithStore(
      <div style={mainArea(NARROW_MAIN)}>
        <ReviewHeader review={review} artifactsOpen={false} onToggleArtifacts={() => undefined} />
      </div>,
      {
        state: makeState({ reviews: [review] }),
        ui: { location: { kind: "review", id: review.id } },
      },
    );
    expect(LONGEST_TITLE).toHaveLength(256);
    expect(placeHeaderFits(screen.getByRole("banner"))).toBe(true);
  });
});
