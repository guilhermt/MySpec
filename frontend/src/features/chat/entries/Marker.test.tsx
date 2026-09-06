import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Marker } from "@/features/chat/entries/Marker";
import type { MarkerType } from "@/lib/wails";
import { renderWithStore } from "@/test/render";

describe("Marker", () => {
  it.each([
    ["prd_written", "PRD written"],
    ["prd_updated", "PRD updated"],
    ["compacted", "Context compacted"],
    ["interrupted", "Interrupted"],
  ] as const)("names the %s milestone", (type: MarkerType, expected) => {
    renderWithStore(<Marker marker={{ type, preTokens: 0 }} createdAt="2026-09-05T10:00:00Z" />);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("shows the time the milestone happened", () => {
    renderWithStore(
      <Marker marker={{ type: "compacted", preTokens: 120000 }} createdAt="2026-09-05T10:00:00Z" />,
    );

    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it("leaves the time out when there is none to show", () => {
    renderWithStore(<Marker marker={{ type: "compacted", preTokens: 0 }} createdAt="" />);

    expect(screen.queryByText(/^\d{2}:\d{2}$/)).not.toBeInTheDocument();
  });
});
