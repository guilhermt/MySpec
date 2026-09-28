import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { inkRuns, mainArea, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { Pill, type PillView } from "./Pill";

const PILL: PillView = {
  name: "Implementation",
  position: "3/7",
  qualifier: "pass 2",
  keepsQualifier: false,
  glyph: "wait",
  word: "",
  shimmer: false,
  paused: false,
  state: "waiting for you: question in Reviewer",
};

function pill(view: PillView, width = 1400) {
  const { container } = render(
    <div style={mainArea(width)}>
      <Pill pill={view} />
    </div>,
  );
  return container.firstElementChild?.firstElementChild as HTMLElement;
}

describe.each(THEMES)("Pill in the %s theme", (theme) => {
  it("is a pill of --size-control-sm on the brand plane with the marker ring", () => {
    setTheme(theme);
    const body = pill(PILL);
    const want = {
      background: token("--brand-tint-plane"),
      shadow: resolve("inset 0 0 0 var(--border) var(--brand-marker-ring)", "box-shadow"),
      height: "28px",
    };
    expect(paintOf(body, want)).toEqual(want);
    expect(getComputedStyle(body).paddingLeft).toBe("12px");
  });

  it("names the stage in the brand ink, semibold, and the position in the second ink", () => {
    setTheme(theme);
    pill(PILL);
    const name = screen.getByText("Implementation");
    expect(paintOf(name, { color: "" })).toEqual({ color: token("--brand-ink") });
    expect(getComputedStyle(name).fontWeight).toBe("600");
    const position = screen.getByText(/^3\/7/);
    expect(paintOf(position, { color: "" })).toEqual({ color: token("--ink-2") });
    expect(getComputedStyle(position).fontVariantNumeric).toBe("tabular-nums");
  });

  it("draws the divider in the marker ring", () => {
    setTheme(theme);
    const body = pill(PILL);
    const divider = body.querySelector<HTMLElement>('span[aria-hidden="true"]:not([data-state])');
    expect(divider).not.toBeNull();
    expect(getComputedStyle(divider as HTMLElement).backgroundColor).toBe(
      token("--brand-marker-ring"),
    );
  });

  it.each([
    ["working", "work", "400"],
    ["checking GitHub", "github", "400"],
    ["checks 3/5", "github", "400"],
    ["committing", "close", "500"],
  ] as const)("writes %s with the %s glyph at weight %s", (word, glyph, weight) => {
    setTheme(theme);
    pill({ ...PILL, glyph, word });
    expect(getComputedStyle(screen.getByText(word)).fontWeight).toBe(weight);
  });

  it("is neutral when paused", () => {
    setTheme(theme);
    const body = pill({ ...PILL, glyph: "paused", word: "paused", paused: true });
    const want = {
      background: token("--surface-0"),
      shadow: resolve("inset 0 0 0 var(--border) var(--line-2)", "box-shadow"),
    };
    expect(paintOf(body, want)).toEqual(want);
    expect(paintOf(screen.getByText("Implementation"), { color: "" })).toEqual({
      color: token("--ink-2"),
    });
  });

  it("draws the two bars of the paused glyph whole at its small size", async () => {
    setTheme(theme);
    const body = pill({ ...PILL, glyph: "paused", word: "paused", paused: true });
    const glyph = body.querySelector('[data-state="paused"]');
    if (!(glyph instanceof HTMLElement)) {
      throw new Error("the paused glyph is not drawn");
    }
    expect(glyph.getBoundingClientRect().width).toBe(
      parseFloat(resolve("var(--glyph-sm)", "width")),
    );
    // The glyph is read on a plain frame, so the first pixel of the screenshot is background.
    const frame = document.createElement("span");
    frame.style.cssText =
      "display: inline-flex; padding: var(--space-0-5); background: var(--surface-0)";
    glyph.replaceWith(frame);
    frame.append(glyph);
    const bar = parseFloat(resolve("var(--glyph-bar)", "width"));
    expect(await inkRuns(frame)).toEqual([bar, bar]);
  });

  it("narrows its padding below 1040px of main area", () => {
    setTheme(theme);
    const body = pill(PILL, 1000);
    expect(getComputedStyle(body).paddingLeft).toBe("10px");
  });
});
