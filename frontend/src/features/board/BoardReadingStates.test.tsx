import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FailureStrip } from "@/features/board/BoardReadingStates";
import { renderWithStore } from "@/test/render";
import { makeBoard } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-16T12:10:00Z");
const FAILURE = {
  reason: "rate_limited",
  message: "GitHub limits.",
  failedAt: "2026-09-16T12:03:00Z",
};

describe("FailureStrip", () => {
  it("has no role for a failure that was there when the screen opened", () => {
    renderWithStore(
      <FailureStrip
        board={makeBoard({ readAt: "2026-09-16T11:00:00Z", failure: FAILURE })}
        now={NOW}
      />,
    );

    expect(screen.getByText("GitHub limits.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("is an alert for a failure that arrives after the screen", () => {
    const board = makeBoard({ readAt: "2026-09-16T11:00:00Z" });
    const { rerender } = renderWithStore(<FailureStrip board={board} now={NOW} />);
    expect(screen.queryByText("GitHub limits.")).not.toBeInTheDocument();

    rerender(<FailureStrip board={{ ...board, failure: FAILURE }} now={NOW} />);

    expect(screen.getByRole("alert")).toHaveTextContent("GitHub limits.");
  });
});
