import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewView } from "@/features/reviews/ReviewView";
import { api, type ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReview, makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

/**
 * measuredPanels lays the resizable panels out, which jsdom does not: an
 * element is as wide as the share of the group its panel has, and the
 * observers of the panels hear about it when the test measures.
 */
function measuredPanels() {
  const observers: { callback: ResizeObserverCallback; targets: Element[] }[] = [];
  const original = globalThis.ResizeObserver;
  vi.stubGlobal(
    "ResizeObserver",
    class implements ResizeObserver {
      private readonly entry: { callback: ResizeObserverCallback; targets: Element[] };
      constructor(callback: ResizeObserverCallback) {
        this.entry = { callback, targets: [] };
        observers.push(this.entry);
      }
      observe(target: Element): void {
        this.entry.targets.push(target);
      }
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    const share = Number.parseFloat(this.style.flexGrow);
    return Number.isNaN(share) ? 0 : share * 10;
  });
  const measure = () => {
    for (const { callback, targets } of observers) {
      const entries = targets.map(
        (target) =>
          ({
            target,
            borderBoxSize: [{ inlineSize: (target as HTMLElement).offsetWidth, blockSize: 0 }],
          }) as unknown as ResizeObserverEntry,
      );
      callback(entries, {} as ResizeObserver);
    }
  };
  const restore = () => {
    width.mockRestore();
    vi.stubGlobal("ResizeObserver", original);
  };
  return { measure, restore };
}

function view(overrides: Partial<ReviewSummary> = {}) {
  return renderWithStore(<ReviewView reviewId="review-1" />, {
    state: makeState({ reviews: [makeReviewSummary(overrides)] }),
  });
}

describe("ReviewView", () => {
  it("puts the header, the bar, the conversation and the reports together", async () => {
    view();

    expect(screen.getByText("Add the login screen")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Reviewing");
    expect(screen.getByText("Reports")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getTranscript).toHaveBeenCalledWith("review-1", "review");
    });
  });

  it("shows the findings of the last pass above the conversation", () => {
    view({ status: "awaiting_decision", passes: [makeReviewPass()] });

    // The panel of the findings names the pass, and so does the list of reports.
    expect(screen.getAllByText("Review 1 · changes")).toHaveLength(2);
    expect(screen.getByLabelText("Finding 1")).toBeInTheDocument();
  });

  it("shows the changes of the agent for the user to stage in apply mode", () => {
    view({ mode: "apply", status: "in_review", review: makeReview() });

    expect(screen.getByRole("progressbar", { name: "Review progress" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(screen.getByText("src/LoginForm.tsx")).toBeInTheDocument();
  });

  it("shows no changes while the findings are still to apply", () => {
    view({ mode: "apply", status: "ready_to_apply", review: makeReview() });

    expect(screen.queryByRole("progressbar", { name: "Review progress" })).toBeNull();
  });

  it("folds the reports panel away from the header", async () => {
    const { measure, restore } = measuredPanels();
    try {
      const { user } = view();
      const reports = () => screen.getByRole("button", { name: "Reports" });
      act(measure);
      expect(reports()).toHaveAttribute("aria-pressed", "true");

      await user.click(reports());
      act(measure);

      expect(reports()).toHaveAttribute("aria-pressed", "false");
    } finally {
      restore();
    }
  });

  it("shows nothing at all for a review that is no longer there", () => {
    const { container } = renderWithStore(<ReviewView reviewId="review-9" />, {
      state: makeState({ reviews: [makeReviewSummary()] }),
    });

    expect(container.querySelector("header")).toBeNull();
  });
});
