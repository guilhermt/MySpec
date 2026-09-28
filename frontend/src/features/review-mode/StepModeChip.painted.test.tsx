import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeStep } from "@/test/wails-mock";
import { StepModeChip } from "./StepModeChip";

function renderChip(own: boolean) {
  renderWithStore(
    <StepModeChip
      step={makeStep({ number: 5, reviewMode: "manual", reviewModeAdjusted: own })}
      taskMode="agent"
      onChange={() => {}}
      onFollow={() => {}}
    />,
  );
  return screen.getByRole("button", { name: "Review mode of step 5: Manual" });
}

describe.each(THEMES)("StepModeChip in the %s theme", (theme) => {
  it("is the small chip, with a step that follows the task in the third ink", () => {
    setTheme(theme);
    const want = {
      color: token("--ink-3"),
      height: resolve("var(--size-chip-sm)", "height"),
      fontSize: resolve("var(--text-micro)", "font-size"),
    };
    expect(paintOf(renderChip(false), want)).toEqual(want);
  });

  it("writes a mode of its own in the first ink with the control line", () => {
    setTheme(theme);
    const want = { color: token("--ink-1"), border: token("--line-3") };
    expect(paintOf(renderChip(true), want)).toEqual(want);
  });
});
