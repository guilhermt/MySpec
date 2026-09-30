import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { FilterBar } from "./FilterBar";

const px = (name: `--${string}`) => parseFloat(resolve(`var(${name})`, "width"));

describe.each(THEMES)("FilterBar in the %s theme", (theme) => {
  it("sticks to the top of the list on the list surface, with room above and below", () => {
    setTheme(theme);
    render(
      <FilterBar label="Filter the cards">
        <span>chip</span>
      </FilterBar>,
    );
    const bar = screen.getByRole("search", { name: "Filter the cards" });
    const style = getComputedStyle(bar);
    expect(style.position).toBe("sticky");
    expect(style.top).toBe("0px");
    expect(style.paddingTop).toBe(`${px("--space-4")}px`);
    expect(style.paddingBottom).toBe(`${px("--space-3")}px`);
    const want = { background: token("--surface-1") };
    expect(paintOf(bar, want)).toEqual(want);
  });

  it("fades the list out under it over --space-3", () => {
    setTheme(theme);
    render(
      <FilterBar label="Filter the cards">
        <span>chip</span>
      </FilterBar>,
    );
    const fade = getComputedStyle(screen.getByRole("search"), "::after");
    expect(fade.height).toBe(`${px("--space-3")}px`);
    expect(fade.pointerEvents).toBe("none");
    expect(fade.backgroundImage).toContain("linear-gradient");
  });
});
