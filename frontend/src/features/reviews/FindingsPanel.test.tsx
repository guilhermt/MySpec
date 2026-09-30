import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FindingsPanel } from "@/features/reviews/FindingsPanel";
import type { ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewFinding, makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

function panel(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary({ passes: [makeReviewPass()], ...overrides });
  return renderWithStore(<FindingsPanel review={review} />, {
    state: makeState({ reviews: [review] }),
  });
}

describe("FindingsPanel", () => {
  it("shows nothing before a report came in", () => {
    const { container } = panel({ passes: [makeReviewPass({ recorded: false })] });

    expect(container).toBeEmptyDOMElement();
  });

  it("is about the last pass that was recorded, and counts the decisions", () => {
    panel({
      passes: [
        makeReviewPass({ pass: 1, published: true, verdict: "comment" }),
        makeReviewPass({
          pass: 2,
          findings: [
            makeReviewFinding({ number: 1, decision: "approved" }),
            makeReviewFinding({ number: 2, path: "src/app.ts", line: 3 }),
          ],
        }),
      ],
    });

    expect(screen.getByText("Review 2 · changes")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 decided")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("leaves the summary to the publish dialog", () => {
    panel();

    expect(screen.queryByLabelText("Summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Two things to fix.")).not.toBeInTheDocument();
  });

  it("says a clean pass has nothing to change", () => {
    panel({ passes: [makeReviewPass({ clean: true, findings: [] })] });

    expect(screen.getByText("Review 1 · clean")).toBeInTheDocument();
    expect(screen.getByText("Nothing to change.")).toBeInTheDocument();
  });

  it("is there to read once the pass was published", () => {
    panel({
      passes: [makeReviewPass({ published: true, verdict: "comment", publishedAt: "2026-09-17" })],
    });

    expect(screen.getByText("Review 1 · changes · published")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("folds away and comes back", async () => {
    const { user } = panel();

    await user.click(screen.getByRole("button", { name: /Review 1 · changes/ }));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /Review 1 · changes/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("opens again when a new pass comes in after a published one", () => {
    const published = makeReviewPass({ published: true, verdict: "comment" });
    const review = makeReviewSummary({ passes: [published] });
    const { rerender } = renderWithStore(<FindingsPanel review={review} />, {
      state: makeState({ reviews: [review] }),
    });
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);

    rerender(
      <FindingsPanel
        review={makeReviewSummary({
          passes: [published, makeReviewPass({ pass: 2, file: "review-2.md" })],
        })}
      />,
    );

    expect(screen.getByText("Review 2 · changes")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
