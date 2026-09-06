import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextGauge } from "@/features/task/ContextGauge";
import { renderWithStore } from "@/test/render";

describe("ContextGauge", () => {
  it("stays out of the way until there is context to report", () => {
    const { container } = renderWithStore(<ContextGauge percent={0} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the share of the context window in use", () => {
    renderWithStore(<ContextGauge percent={42} />);

    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("Context used")).toBeInTheDocument();
  });

  it.each([
    [42, "text-muted-foreground"],
    [75, "text-[var(--status-attention)]"],
    [95, "text-destructive"],
  ])("warns at %i%%", (percent, expected) => {
    const { container } = renderWithStore(<ContextGauge percent={percent} />);

    expect(container.firstElementChild).toHaveClass(expected);
  });
});
