import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { TimeChip } from "./TimeChip";

describe("TimeChip", () => {
  it.each([
    ["wait", "waiting for you, 12 minutes", "bg-state-wait-chip"],
    ["error", "error, waiting for you, 12 minutes", "bg-state-error"],
    ["close", "ready to close, 12 minutes", "text-state-close"],
  ] as const)("reads the %s tone with the time in full", (tone, text, token) => {
    renderWithStore(<TimeChip tone={tone} time="12m" longTime="12 minutes" />);
    const chip = screen.getByText(text).parentElement;
    expect(chip).toHaveClass(token);
    expect(screen.getByText("12m")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the error mark from the screen reader", () => {
    renderWithStore(<TimeChip tone="error" time="3m" longTime="3 minutes" />);
    expect(screen.getByText("!")).toHaveAttribute("aria-hidden", "true");
  });

  it("raises the close chip", () => {
    renderWithStore(<TimeChip tone="close" time="1h" longTime="1 hour" raised />);
    expect(screen.getByText("ready to close, 1 hour").parentElement).toHaveClass("bg-surface-2");
  });
});
