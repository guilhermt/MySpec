import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  it.each([
    ["sm", "size-(--size-mark)", "brand-robot"],
    ["lg", "size-(--size-mark-lg)", "brand-art"],
  ] as const)("draws the %s image", (size, cls, image) => {
    const { container } = renderWithStore(<BrandMark size={size} />);
    expect(container.firstElementChild).toHaveClass(cls);
    expect(container.firstElementChild?.getAttribute("src")).toContain(image);
  });

  it("is decorative", () => {
    const { container } = renderWithStore(<BrandMark size="lg" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild).toHaveAttribute("alt", "");
  });
});
