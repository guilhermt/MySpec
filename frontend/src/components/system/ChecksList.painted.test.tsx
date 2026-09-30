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
    render(<ChecksList summary="3 of 5 passed · 2 not finished" rows={ROWS} onOpen={() => {}} />);
    expect(paintOf(screen.getByText("3 of 5 passed · 2 not finished"), { color: "" })).toEqual({
      color: token("--ink-2"),
    });
  });

  it.each([
    [false, "--ink-4"],
    [true, "--state-error"],
  ] as const)("writes the trailing text of the summary, in error %s, in %s", (error, color) => {
    setTheme(theme);
    render(
      <ChecksList
        summary="All 6 passed"
        rows={[]}
        onOpen={() => {}}
        trailing={{ text: "read 2m ago", error }}
      />,
    );
    const trailing = screen.getByText("read 2m ago");
    expect(paintOf(trailing, { color: "" })).toEqual({ color: token(color) });
    expect(getComputedStyle(trailing).fontVariantNumeric).toBe("tabular-nums");
  });

  it("writes the name in mono in the first ink and the duration in the fourth", () => {
    setTheme(theme);
    render(<ChecksList summary="" rows={ROWS} onOpen={() => {}} />);
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
    render(<ChecksList summary="" rows={ROWS} onOpen={() => {}} />);
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
    render(<ChecksList summary="" rows={ROWS} onOpen={() => {}} />);
    const check = row(name).querySelector("svg") as SVGElement;
    expect(getComputedStyle(check).color).toBe(token(color));
  });

  it("draws the failure as the error diamond", () => {
    setTheme(theme);
    render(<ChecksList summary="" rows={ROWS} onOpen={() => {}} />);
    const glyph = row("e2e").querySelector('[data-state="error"]') as HTMLElement;
    expect(getComputedStyle(glyph).backgroundColor).toBe(token("--state-error"));
  });

  it("writes the name of a check with a url in the brand ink, underlined", () => {
    setTheme(theme);
    const rows: readonly CheckRowView[] = [
      {
        name: "build",
        word: "passed",
        glyph: "done",
        tooltip: null,
        duration: "1m 52s",
        url: "https://github.com/acme/web/actions/runs/1",
      },
    ];
    render(<ChecksList summary="" rows={rows} onOpen={() => {}} />);
    const link = screen.getByRole("link", { name: /build/ });
    expect(paintOf(link, { color: "" })).toEqual({ color: token("--brand-ink") });
    expect(getComputedStyle(link).textDecorationLine).toBe("underline");
  });
  it("sinks the live variant into the first surface, the header in the second ink and the age in the fourth", () => {
    setTheme(theme);
    render(
      <ChecksList
        summary=""
        rows={ROWS}
        onOpen={() => {}}
        live={{
          header: "Waiting for checks · 4 of 6 passed",
          age: "checked just now",
          ageTooltip: "Checked at 14:02",
          reading: false,
        }}
      />,
    );
    const header = screen.getByText("Waiting for checks · 4 of 6 passed");
    expect(paintOf(header, { color: "" })).toEqual({ color: token("--ink-2") });
    expect(paintOf(screen.getByText("checked just now"), { color: "" })).toEqual({
      color: token("--ink-4"),
    });
    const block = header.parentElement?.parentElement as HTMLElement;
    expect(paintOf(block, { background: "" })).toEqual({ background: token("--surface-0") });
    const glyph = document.querySelector('[data-state="github"]') as HTMLElement;
    expect(getComputedStyle(glyph).borderStyle).toBe("dashed");
  });
});
