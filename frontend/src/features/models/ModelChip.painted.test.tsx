import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";
import { ModelChip } from "./ModelChip";

function renderChip(own: boolean) {
  renderWithStore(
    <ModelChip
      value={{ model: "claude-sonnet-5", effort: "high" }}
      onChange={() => {}}
      label="Step 5"
      own={own}
      followNote={own ? "Its own model · Implementation uses Opus 5.5 (1M) · high" : ""}
    />,
    { state: makeState() },
  );
  return screen.getByRole("button", { name: /Step 5 model/ });
}

describe.each(THEMES)("ModelChip in the %s theme", (theme) => {
  it("is the small chip, with a choice that follows in the third ink", () => {
    setTheme(theme);
    const want = {
      color: token("--ink-3"),
      height: resolve("var(--size-chip-sm)", "height"),
      fontSize: resolve("var(--text-micro)", "font-size"),
    };
    expect(paintOf(renderChip(false), want)).toEqual(want);
  });

  it("writes an own choice in the first ink with the control line", () => {
    setTheme(theme);
    const want = { color: token("--ink-1"), border: token("--line-3") };
    expect(paintOf(renderChip(true), want)).toEqual(want);
  });
});
