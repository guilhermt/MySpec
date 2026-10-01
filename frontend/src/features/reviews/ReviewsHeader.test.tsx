import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewsHeader } from "@/features/reviews/ReviewsHeader";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewCenter, makeState } from "@/test/wails-mock";

const READ_AT = "2026-09-16T12:00:00Z";
const TWO_MINUTES_LATER = Date.parse(READ_AT) + 2 * 60_000;

describe("ReviewsHeader", () => {
  it("names the view", () => {
    renderWithStore(<ReviewsHeader center={makeReviewCenter()} now={TWO_MINUTES_LATER} />, {
      state: makeState(),
      ui: { location: { kind: "reviews" } },
    });

    expect(screen.getByRole("heading", { level: 1, name: "Reviews" })).toBeInTheDocument();
  });

  it("says how long ago the pull requests were read", () => {
    renderWithStore(
      <ReviewsHeader center={makeReviewCenter({ readAt: READ_AT })} now={TWO_MINUTES_LATER} />,
    );

    expect(screen.getByText("Read 2m ago")).toBeInTheDocument();
  });

  it("says nothing of a list never read", () => {
    renderWithStore(<ReviewsHeader center={makeReviewCenter()} now={TWO_MINUTES_LATER} />);

    expect(screen.queryByText(/^Read /)).not.toBeInTheDocument();
  });

  it("tells that a reading is running, and keeps another from starting", () => {
    renderWithStore(
      <ReviewsHeader
        center={makeReviewCenter({ readAt: READ_AT, reading: true })}
        now={TWO_MINUTES_LATER}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Reading…");
    expect(screen.queryByText("Read 2m ago")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("reads the pull requests again on Refresh", async () => {
    const { user } = renderWithStore(
      <ReviewsHeader center={makeReviewCenter()} now={TWO_MINUTES_LATER} />,
    );

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(api.refreshPullRequests).toHaveBeenCalledOnce();
  });
});
