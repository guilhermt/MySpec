import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportsPanel } from "@/features/reviews/ReportsPanel";
import { api } from "@/lib/wails";
import { HEADED, paintOf, setTheme, THEMES, TRANSPARENT, token, uiHeadings } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

// report opens the report of the first pass, as a marker of the conversation asks for it.
function report() {
  const review = makeReviewSummary({ passes: [makeReviewPass()] });
  return renderWithStore(<ReportsPanel review={review} />, {
    state: makeState({ reviews: [review] }),
    ui: { panel: "reports", panelDocument: "review-1.md" },
  });
}

describe.each(THEMES)("ReportsPanel in the %s theme", (theme) => {
  it("draws the headings of a report at the size of the UI, in 600", async () => {
    setTheme(theme);
    vi.mocked(api.readReviewArtifact).mockImplementation(() => Promise.resolve(HEADED));
    report();

    const { got, want } = await uiHeadings();
    expect(got).toEqual(want);
  });

  it("says a read that failed in the sunken strip, with a ghost Try again", async () => {
    setTheme(theme);
    vi.mocked(api.readReviewArtifact).mockImplementation(() =>
      Promise.reject(new Error("No such file.")),
    );
    report();

    const strip = await screen.findByRole("alert");
    expect(paintOf(strip, { background: "" })).toEqual({ background: token("--surface-0") });
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(paintOf(retry, { background: "" })).toEqual({ background: TRANSPARENT });
  });
});
