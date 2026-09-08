import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Marker } from "@/features/chat/entries/Marker";
import type { MarkerType } from "@/lib/wails";
import { renderWithStore } from "@/test/render";

describe("Marker", () => {
  it.each([
    ["prd_written", "PRD written"],
    ["prd_updated", "PRD updated"],
    ["tech_spec_written", "Tech spec written"],
    ["tech_spec_updated", "Tech spec updated"],
    ["plan_written", "Plan written"],
    ["plan_updated", "Plan updated"],
    ["compacted", "Context compacted"],
    ["interrupted", "Interrupted"],
  ] as const)("names the %s milestone", (type: MarkerType, expected) => {
    renderWithStore(
      <Marker
        marker={{ type, preTokens: 0, stage: "", step: 0, pass: 0, restarted: false }}
        createdAt="2026-09-05T10:00:00Z"
      />,
    );

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it.each([
    [false, "Tech spec started"],
    [true, "Tech spec restarted"],
  ])("names the stage a stage_started marker opened (restarted: %s)", (restarted, expected) => {
    renderWithStore(
      <Marker
        marker={{
          type: "stage_started",
          preTokens: 0,
          stage: "tech_spec",
          step: 0,
          pass: 0,
          restarted,
        }}
        createdAt="2026-09-05T10:00:00Z"
      />,
    );

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it.each([
    [false, "Step 1 started"],
    [true, "Step 1 restarted"],
  ])("names the step a step_started marker opened (restarted: %s)", (restarted, expected) => {
    renderWithStore(
      <Marker
        marker={{ type: "step_started", preTokens: 0, stage: "", step: 1, pass: 0, restarted }}
        createdAt="2026-09-05T10:00:00Z"
      />,
    );

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("shows the time the milestone happened", () => {
    renderWithStore(
      <Marker
        marker={{
          type: "compacted",
          preTokens: 120000,
          stage: "",
          step: 0,
          pass: 0,
          restarted: false,
        }}
        createdAt="2026-09-05T10:00:00Z"
      />,
    );

    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it("leaves the time out when there is none to show", () => {
    renderWithStore(
      <Marker
        marker={{ type: "compacted", preTokens: 0, stage: "", step: 0, pass: 0, restarted: false }}
        createdAt=""
      />,
    );

    expect(screen.queryByText(/^\d{2}:\d{2}$/)).not.toBeInTheDocument();
  });
});
