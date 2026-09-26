import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Kbd } from "./Kbd";

describe("Kbd", () => {
  it("renders its key with the thicker bottom border", () => {
    renderWithStore(<Kbd>K</Kbd>);
    const key = screen.getByText("K");
    expect(key.tagName).toBe("KBD");
    expect(key).toHaveClass("border-b-(length:--border-2)", "h-(--size-kbd)", "font-mono");
    expect(key).not.toHaveClass("font-sans");
    expect(key).not.toHaveClass("rounded-sm");
  });

  it("uses the small size", () => {
    renderWithStore(<Kbd size="sm">K</Kbd>);
    expect(screen.getByText("K")).toHaveClass("h-(--size-kbd-sm)");
  });

  it("sits on the primary button", () => {
    renderWithStore(<Kbd variant="on-primary">Enter</Kbd>);
    expect(screen.getByText("Enter")).toHaveClass("text-brand-on", "bg-transparent");
  });

  it("marks the jump key", () => {
    renderWithStore(<Kbd variant="jump">Ctrl J</Kbd>);
    expect(screen.getByText("Ctrl J")).toHaveClass("bg-brand-tint", "text-brand-ink");
  });
});
