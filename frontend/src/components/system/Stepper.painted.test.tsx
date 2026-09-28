import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, mainArea, paintOf, setTheme, THEMES, token } from "@/test/painted";
import type { PillView } from "./Pill";
import { Stepper, type StepperStepView } from "./Stepper";

const STEPS: readonly StepperStepView[] = [
  { id: "prd", name: "PRD", state: "done" },
  { id: "techspec", name: "Tech spec", state: "done" },
  { id: "plan", name: "Plan", state: "done" },
  { id: "implementation", name: "Implementation", state: "current" },
  { id: "pr", name: "PR", state: "upcoming" },
  { id: "pr_review", name: "PR review", state: "upcoming" },
  { id: "closing", name: "Closing", state: "upcoming" },
];

const PILL: PillView = {
  name: "Implementation",
  position: "3/7",
  qualifier: "round 1",
  keepsQualifier: false,
  glyph: "work",
  word: "working",
  shimmer: false,
  paused: false,
  state: "Implementer working",
};

// stepper draws the stepper inside a main area of a fixed width, the container its queries measure.
function stepper(width: number, loading = false) {
  render(
    <div style={mainArea(width)}>
      <Stepper
        steps={STEPS}
        pill={PILL}
        label="Progress · Implementation 3/7 · round 1 · Implementer working"
        tooltip={["✓ PRD  ✓ Tech spec  ✓ Plan  ● Implementation 3/7 · round 1"]}
        loading={loading}
      />
    </div>,
  );
  return screen.getByRole("list");
}

// shown tells whether a text is drawn: an sr-only text is a clipped box of one pixel.
function shown(text: string): boolean {
  return screen.getByText(text).getBoundingClientRect().width > 1;
}

// dashes are the lines drawn between the stages.
function dashes(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>("li > span[aria-hidden]")];
}

describe.each(THEMES)("Stepper in the %s theme", (theme) => {
  it("writes the done stages in the third ink and the ones to come in the fourth", () => {
    setTheme(theme);
    stepper(1400);
    expect(paintOf(screen.getByText("PRD"), { color: "" })).toEqual({ color: token("--ink-3") });
    expect(paintOf(screen.getByText("PR"), { color: "" })).toEqual({ color: token("--ink-4") });
  });

  it("joins the stages with dashes in the second line", () => {
    setTheme(theme);
    const list = stepper(1400);
    const lines = dashes(list);
    expect(lines).toHaveLength(6);
    for (const line of lines) {
      expect(getComputedStyle(line).backgroundColor).toBe(token("--line-2"));
      expect(line.getBoundingClientRect().width).toBe(12);
    }
  });

  it("shows the focus ring on keyboard focus", async () => {
    setTheme(theme);
    const list = stepper(1400);
    await userEvent.keyboard("{Tab}");
    const want = focusRing();
    expect(paintOf(list, want)).toEqual(want);
  });

  it.each([
    [1400, { dashes: true, done: true, qualifier: true, upcoming: true }],
    [1299, { dashes: false, done: true, qualifier: true, upcoming: true }],
    [1199, { dashes: false, done: false, qualifier: true, upcoming: true }],
    [1039, { dashes: false, done: false, qualifier: false, upcoming: true }],
    [899, { dashes: false, done: false, qualifier: false, upcoming: false }],
  ])("gives way at %ipx of main area", (width, want) => {
    setTheme(theme);
    const list = stepper(width);
    expect({
      dashes: dashes(list).every((line) => line.getBoundingClientRect().width > 0),
      done: shown("PRD"),
      qualifier: shown("working") && screen.getByText(/round 1/).getBoundingClientRect().width > 1,
      upcoming: shown("Closing"),
    }).toEqual(want);
    // The name of the current stage never gives way.
    expect(shown("Implementation")).toBe(true);
  });

  it.each([
    [1400, "6px"],
    [1299, "10px"],
    [1199, "8px"],
  ])("spaces the stages at %ipx of main area by %s", (width, gap) => {
    setTheme(theme);
    expect(getComputedStyle(stepper(width)).columnGap).toBe(gap);
  });

  it.each([
    [1100, "6px"],
    [1000, "4px"],
  ])("spaces the sign and the name at %ipx of main area by %s", (width, gap) => {
    setTheme(theme);
    stepper(width);
    const stage = screen.getByText("Closing").parentElement as HTMLElement;
    expect(getComputedStyle(stage).columnGap).toBe(gap);
  });

  it.each([
    [1100, "8px"],
    [1000, "0px"],
  ])("keeps a left margin at %ipx of main area of %s", (width, margin) => {
    setTheme(theme);
    expect(getComputedStyle(stepper(width)).marginLeft).toBe(margin);
  });

  it("glows over the names while loading", () => {
    setTheme(theme);
    stepper(1400, true);
    expect(screen.getByText("Implementation")).toHaveClass("shimmer-text");
    expect(screen.queryByText("3/7")).toBeNull();
  });
});
