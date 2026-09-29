import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { ListSectionHeader } from "./ListSectionHeader";

function draw(props: { collapsed?: boolean; empty?: boolean } = {}) {
  render(
    <ListSectionHeader
      id="done"
      name="Done"
      count={70}
      collapsed={props.collapsed ?? false}
      empty={props.empty ?? false}
      final
      tooltip={null}
      label="Done, 70 cards, final status"
      tabStop
      onToggle={() => {}}
      onFocus={() => {}}
    />,
  );
  return screen.getByRole("treeitem");
}

describe.each(THEMES)("ListSectionHeader in the %s theme", (theme) => {
  it("is --size-node tall", () => {
    setTheme(theme);
    expect(draw().getBoundingClientRect().height).toBe(
      parseFloat(resolve("var(--size-node)", "height")),
    );
  });

  it("writes its name at 600 and its count in the fourth ink", () => {
    setTheme(theme);
    draw();
    expect(getComputedStyle(screen.getByText("Done")).fontWeight).toBe("600");
    expect(getComputedStyle(screen.getByText("70")).color).toBe(token("--ink-4"));
  });

  it("steps up on hover, but not when empty", async () => {
    setTheme(theme);
    const header = draw();
    await userEvent.hover(header);
    const want = { background: token("--veil-hover") };
    expect(paintOf(header, want)).toEqual(want);
  });

  it("has no hover when empty", async () => {
    setTheme(theme);
    const header = draw({ empty: true });
    await userEvent.hover(header);
    expect(getComputedStyle(header).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });

  it("turns its chevron down when expanded and leaves it when collapsed", () => {
    setTheme(theme);
    const expanded = draw();
    expect(getComputedStyle(expanded.querySelector("svg") as SVGElement).rotate).toBe("90deg");
  });

  it("leaves the chevron when collapsed", () => {
    setTheme(theme);
    const collapsed = draw({ collapsed: true });
    expect(getComputedStyle(collapsed.querySelector("svg") as SVGElement).rotate).toBe("none");
  });

  it("shows the focus ring", async () => {
    setTheme(theme);
    const header = draw();
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(header, want)).toEqual(want);
  });
});
