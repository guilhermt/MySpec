import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { DaySectionHeader } from "./ListSectionHeader";

function draw() {
  render(
    <DaySectionHeader
      id="2026-09-22"
      name="Monday, Sep 22"
      count={5}
      label="Archived on Monday, Sep 22: 5"
      tabStop
      onFocus={() => {}}
    />,
  );
  return screen.getByRole("treeitem");
}

describe.each(THEMES)("DaySectionHeader in the %s theme", (theme) => {
  it("is --size-node tall", () => {
    setTheme(theme);
    expect(draw().getBoundingClientRect().height).toBe(
      parseFloat(resolve("var(--size-node)", "height")),
    );
  });

  it("writes its name at 600 in the second ink and its count in the fourth", () => {
    setTheme(theme);
    draw();
    const name = getComputedStyle(screen.getByText("Monday, Sep 22"));
    expect(name.fontWeight).toBe("600");
    expect(name.color).toBe(token("--ink-2"));
    expect(getComputedStyle(screen.getByText("5")).color).toBe(token("--ink-4"));
  });

  it("steps up on hover", async () => {
    setTheme(theme);
    const header = draw();
    await userEvent.hover(header);
    const want = { background: token("--veil-hover") };
    expect(paintOf(header, want)).toEqual(want);
  });

  it("shows the focus ring", async () => {
    setTheme(theme);
    const header = draw();
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(header, want)).toEqual(want);
  });
});
