import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Icon } from "./Icon";
import { ICONS } from "./icons";

describe("Icon", () => {
  it("is hidden from assistive technology", () => {
    const { container } = renderWithStore(<Icon icon={ICONS.done} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it.each([
    ["md", "size-(--icon)"],
    ["sm", "size-(--icon-sm)"],
    ["xs", "size-(--icon-xs)"],
  ] as const)("applies the %s size", (size, cls) => {
    const { container } = renderWithStore(<Icon icon={ICONS.done} size={size} />);
    expect(container.querySelector("svg")).toHaveClass(cls);
  });

  it.each([
    ["muted", "text-ink-3"],
    ["active", "text-brand-ink"],
  ] as const)("applies the %s tone", (tone, cls) => {
    const { container } = renderWithStore(<Icon icon={ICONS.done} tone={tone} />);
    expect(container.querySelector("svg")).toHaveClass(cls);
  });

  it("maps each meaning to a different icon", () => {
    expect(new Set(Object.values(ICONS)).size).toBe(Object.keys(ICONS).length);
  });
});
