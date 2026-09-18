import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewsHeader } from "@/features/reviews/ReviewsHeader";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewCenter, makeState } from "@/test/wails-mock";

describe("ReviewsHeader", () => {
  it("names the view", () => {
    renderWithStore(<ReviewsHeader center={makeReviewCenter()} />, { state: makeState() });

    expect(screen.getByRole("heading", { level: 1, name: "Reviews" })).toBeInTheDocument();
  });

  it("says when the pull requests were last read", () => {
    renderWithStore(
      <ReviewsHeader center={makeReviewCenter({ readAt: "2026-09-16T12:00:00Z" })} />,
    );

    expect(screen.getByText(/^Updated /)).toBeInTheDocument();
  });

  it("tells that a reading is running, and keeps another from starting", () => {
    renderWithStore(<ReviewsHeader center={makeReviewCenter({ reading: true })} />);

    expect(screen.getByRole("status", { name: "Reading pull requests" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  });

  it("reads the pull requests again on Refresh", async () => {
    const { user } = renderWithStore(<ReviewsHeader center={makeReviewCenter()} />);

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(api.refreshPullRequests).toHaveBeenCalledOnce();
  });
});
