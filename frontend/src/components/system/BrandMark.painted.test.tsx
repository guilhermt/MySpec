import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { BrandMark } from "./BrandMark";

describe.each(THEMES)("BrandMark in the %s theme", (theme) => {
  it.each([
    ["sm", "--size-mark", "--radius-sm"],
    ["lg", "--space-8", "--radius-md"],
  ] as const)("paints the %s square in the brand", (size, side, radius) => {
    setTheme(theme);
    const { container } = render(<BrandMark size={size} />);
    const style = getComputedStyle(container.firstElementChild as Element);
    expect(style.backgroundColor).toBe(token("--brand"));
    expect(style.color).toBe(token("--brand-on"));
    expect(style.width).toBe(resolve(`var(${side})`, "width"));
    expect(style.height).toBe(resolve(`var(${side})`, "height"));
    expect(style.borderTopLeftRadius).toBe(resolve(`var(${radius})`, "border-top-left-radius"));
  });
});
