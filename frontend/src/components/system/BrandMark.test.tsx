import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  it.each([
    ["sm", "size-(--size-mark)"],
    ["lg", "size-(--space-8)"],
  ] as const)("draws the %s square", (size, cls) => {
    const { container } = renderWithStore(<BrandMark size={size} />);
    expect(container.firstElementChild).toHaveClass(cls);
  });

  it("is hidden from assistive technology", () => {
    const { container } = renderWithStore(<BrandMark size="lg" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
