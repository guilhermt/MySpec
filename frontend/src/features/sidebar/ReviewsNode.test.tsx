import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { REVIEWS_NODE, ReviewsNode } from "@/features/sidebar/ReviewsNode";
import type { ReviewSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, type StoreOptions } from "@/test/render";
import {
  makeRepository,
  makeReviewCenter,
  makeReviewSummary,
  makeSituation,
  makeState,
} from "@/test/wails-mock";

const DECIDE = makeSituation({
  id: "decide",
  taskId: "review-1",
  kind: "review_report",
  form: "decide",
  place: { kind: "review", stage: "", step: 0 },
});

function node(reviews: ReviewSummary[] = [makeReviewSummary()], options: StoreOptions = {}) {
  return renderWithStore(<ReviewsNode />, {
    state: makeState({ reviews }),
    ...options,
  });
}

describe("ReviewsNode", () => {
  it("lists every active review with its pull request and where it stands", () => {
    node([
      makeReviewSummary(),
      makeReviewSummary({
        id: "review-2",
        repository: "dev/api",
        number: 7,
        title: "Cache the sessions",
        status: "ready_to_publish",
      }),
    ]);

    expect(
      screen.getByRole("button", { name: "web#31, Add the login screen, Reviewing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "api#7, Cache the sessions, Ready to publish" }),
    ).toBeInTheDocument();
  });

  it("reads what a review waits on the user for over its status", () => {
    node([makeReviewSummary({ status: "awaiting_decision", situations: [DECIDE] })]);

    expect(screen.getByRole("button", { name: /^web#31,/ })).toHaveTextContent("Decide findings");
  });

  it("counts the pull requests pending a review, only when there are any", () => {
    renderWithStore(<ReviewsNode />, {
      state: makeState({ reviewCenter: makeReviewCenter({ pendingCount: 3 }) }),
    });

    expect(screen.getByRole("img", { name: "3 pending" })).toHaveTextContent("3");
  });

  it("shows no count when nothing is pending", () => {
    node();

    expect(screen.queryByRole("img", { name: /pending/ })).not.toBeInTheDocument();
  });

  it("opens the Reviews view and reads as the page on screen", async () => {
    const { user } = node();

    await user.click(screen.getByRole("button", { name: "Reviews" }));

    expect(useAppStore.getState().reviewsOpen).toBe(true);
    expect(screen.getByRole("button", { name: "Reviews" })).toHaveAttribute("aria-current", "page");
  });

  it("opens the review the user picks and marks its row", async () => {
    const { user } = node();

    await user.click(screen.getByRole("button", { name: /^web#31,/ }));

    expect(useAppStore.getState().openReviewId).toBe("review-1");
    expect(screen.getByRole("button", { name: /^web#31,/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("collapses the reviews under it and expands them again", async () => {
    const { user } = node();

    await user.click(screen.getByRole("button", { name: "Collapse Reviews" }));

    expect(screen.queryByRole("button", { name: /^web#31,/ })).not.toBeInTheDocument();
    expect(useAppStore.getState().sidebarCollapsed.has(REVIEWS_NODE)).toBe(true);

    await user.click(screen.getByRole("button", { name: "Expand Reviews" }));

    expect(screen.getByRole("button", { name: /^web#31,/ })).toBeInTheDocument();
  });

  it("expands when a review opens", () => {
    node([makeReviewSummary()], { ui: { sidebarCollapsed: new Set([REVIEWS_NODE]) } });
    expect(screen.queryByRole("button", { name: /^web#31,/ })).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().openReview("review-1");
    });

    expect(screen.getByRole("button", { name: /^web#31,/ })).toBeInTheDocument();
  });

  it("highlights a review whose situation just started", () => {
    node([makeReviewSummary({ situations: [DECIDE] })], {
      ui: { flashing: new Set(["decide"]) },
    });

    const row = screen.getByRole("button", { name: /^web#31,/ });
    expect(row).toHaveClass("attention-flash");
    expect(row).toHaveAttribute("data-tone", "attention");
  });

  it("shows every review whatever the repository filter of the sidebar", () => {
    renderWithStore(<ReviewsNode />, {
      state: makeState({
        repositories: [makeRepository(), makeRepository({ id: "repo-2", fullName: "dev/api" })],
        repositoryFilter: "repo-2",
        reviews: [makeReviewSummary()],
      }),
    });

    expect(screen.getByRole("button", { name: /^web#31,/ })).toBeInTheDocument();
  });
});
