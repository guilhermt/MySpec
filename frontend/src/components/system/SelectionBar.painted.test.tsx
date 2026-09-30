import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, setTheme, THEMES, token } from "@/test/painted";
import { SelectionBar } from "./SelectionBar";

describe.each(THEMES)("SelectionBar in the %s theme", (theme) => {
  it("is neutral: the sunken surface with the second line", () => {
    setTheme(theme);
    render(
      <SelectionBar
        count={2}
        numbers="#474 #412"
        filtered={false}
        filteredTooltip={[]}
        onDiscuss={() => {}}
        onCancel={() => {}}
      />,
    );
    const bar = screen.getByRole("toolbar", { name: "Selected cards" });
    const want = { background: token("--surface-0") };
    expect(paintOf(bar, want)).toEqual(want);
    expect(getComputedStyle(bar).boxShadow).toContain(token("--line-2"));
    expect(getComputedStyle(screen.getByText("#474 #412")).color).toBe(token("--ink-3"));
    expect(getComputedStyle(screen.getByText("2 selected")).fontWeight).toBe("600");
  });

  it("has one primary", () => {
    setTheme(theme);
    render(
      <SelectionBar
        count={0}
        numbers=""
        filtered={false}
        filteredTooltip={[]}
        onDiscuss={() => {}}
        onCancel={() => {}}
      />,
    );
    const primary = document.querySelectorAll('[data-variant="primary"]');
    expect(primary).toHaveLength(1);
  });
});
