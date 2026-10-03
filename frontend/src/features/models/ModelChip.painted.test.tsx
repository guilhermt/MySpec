import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";
import { ModelChip } from "./ModelChip";

function renderChip(own: boolean, factory = false) {
  renderWithStore(
    <ModelChip
      value={{ model: "claude-sonnet-5", effort: "high" }}
      onChange={() => {}}
      label="Step 5"
      own={own}
      {...(factory ? { factory: { model: "claude-opus-5-5[1m]", effort: "high" } } : {})}
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

  it("writes the factory mark and the foot of the menu small, in the third ink", async () => {
    setTheme(theme);
    await userEvent.click(renderChip(false, true));

    const mark = (await screen.findByRole("menuitemradio", { name: /^Opus 5.5/ })).lastElementChild;
    const want = { color: token("--ink-3"), fontSize: resolve("var(--text-micro)", "font-size") };
    expect(mark).toHaveTextContent("factory");
    expect(paintOf(mark as Element, want)).toEqual(want);
    expect(
      paintOf(
        screen.getByText("From the Claude Code installed here, read when MySpec opened."),
        want,
      ),
    ).toEqual(want);
  });
});
