import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { type CheckRowView, ChecksList } from "./ChecksList";

const ROWS: readonly CheckRowView[] = [
  { name: "build", word: "passed", glyph: "done", tooltip: null, duration: "1m 52s", url: "" },
  { name: "docs", word: "skipped", glyph: "doneFaint", tooltip: null, duration: "2s", url: "" },
  {
    name: "e2e",
    word: "failed",
    glyph: "error",
    tooltip: "cancelled",
    duration: "5m 02s",
    url: "",
  },
  { name: "unit", word: "running", glyph: "work", tooltip: null, duration: "4m 12s", url: "" },
  { name: "deploy", word: "queued", glyph: "todo", tooltip: null, duration: "—", url: "" },
];

function row(name: string): HTMLElement {
  return screen.getByText(name).closest("li") as HTMLElement;
}

describe.each(THEMES)("ChecksList in the %s theme", (theme) => {
  it("writes the summary in the second ink", () => {
    setTheme(theme);
    render(<ChecksList summary="3 of 5 passed · 2 not finished" rows={ROWS} />);
    expect(paintOf(screen.getByText("3 of 5 passed · 2 not finished"), { color: "" })).toEqual({
      color: token("--ink-2"),
    });
  });

  it("writes the name in mono in the first ink and the duration in the fourth", () => {
    setTheme(theme);
    render(<ChecksList summary="" rows={ROWS} />);
    const name = screen.getByText("build");
    expect(paintOf(name, { color: "" })).toEqual({ color: token("--ink-1") });
    expect(getComputedStyle(name).fontFamily).toBe(resolve("var(--font-mono)", "font-family"));
    const duration = screen.getByText("1m 52s");
    expect(paintOf(duration, { color: "" })).toEqual({ color: token("--ink-4") });
    expect(getComputedStyle(duration).fontVariantNumeric).toBe("tabular-nums");
  });

  it.each([
    ["build", "passed", "--ink-3", "400"],
    ["e2e", "failed", "--state-error", "500"],
    ["unit", "running", "--ink-1", "500"],
    ["deploy", "queued", "--ink-3", "400"],
  ] as const)("writes the state of %s, %s, in %s at %s", (name, word, color, weight) => {
    setTheme(theme);
    render(<ChecksList summary="" rows={ROWS} />);
    const state = screen.getByText(word);
    expect(paintOf(state, { color: "" })).toEqual({ color: token(color) });
    expect(getComputedStyle(state).fontWeight).toBe(weight);
    expect(row(name)).toContainElement(state);
  });

  it.each([
    ["build", "--ink-3"],
    ["docs", "--ink-4"],
  ] as const)("draws the check of %s in %s", (name, color) => {
    setTheme(theme);
    render(<ChecksList summary="" rows={ROWS} />);
    const check = row(name).querySelector("svg") as SVGElement;
    expect(getComputedStyle(check).color).toBe(token(color));
  });

  it("draws the failure as the error diamond", () => {
    setTheme(theme);
    render(<ChecksList summary="" rows={ROWS} />);
    const glyph = row("e2e").querySelector('[data-state="error"]') as HTMLElement;
    expect(getComputedStyle(glyph).backgroundColor).toBe(token("--state-error"));
  });
});
