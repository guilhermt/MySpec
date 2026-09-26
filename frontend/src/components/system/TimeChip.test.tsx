import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { TimeChip } from "./TimeChip";

describe("TimeChip", () => {
  it.each([
    ["wait", "waiting for you 12m", "bg-state-wait-chip"],
    ["error", "error, waiting for you 12m", "bg-state-error"],
    ["close", "ready to close 12m", "text-state-close"],
  ] as const)("reads the %s tone", (tone, text, token) => {
    renderWithStore(<TimeChip tone={tone} time="12m" longTime="12 minutes" />);
    const chip = screen.getByText(text.split(" 12m")[0] as string).parentElement;
    expect(chip).toHaveClass(token);
    expect(chip).toHaveTextContent("12m");
  });

  it("keeps the error mark from the screen reader", () => {
    renderWithStore(<TimeChip tone="error" time="3m" longTime="3 minutes" />);
    expect(screen.getByText("!")).toHaveAttribute("aria-hidden", "true");
  });

  it("raises the close chip", () => {
    renderWithStore(<TimeChip tone="close" time="1h" longTime="1 hour" raised />);
    expect(screen.getByText("ready to close").parentElement).toHaveClass("bg-surface-2");
  });
});
