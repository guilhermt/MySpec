import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  focusRing,
  NONE,
  paintOf,
  resolve,
  setTheme,
  THEMES,
  TRANSPARENT,
  token,
} from "@/test/painted";
import { PanelRow } from "./PanelRow";

describe.each(THEMES)("PanelRow in the %s theme", (theme) => {
  it("writes the text in the first ink and the meta in the third, in the micro type", () => {
    setTheme(theme);
    render(
      <PanelRow glyph={<span>✓</span>} meta="a1b2c3d">
        Add the login form
      </PanelRow>,
    );
    const text = screen.getByText("Add the login form");
    expect(paintOf(text, { color: "" })).toEqual({ color: token("--ink-1") });
    const meta = { color: token("--ink-3"), fontSize: resolve("var(--text-micro)", "font-size") };
    expect(paintOf(screen.getByText("a1b2c3d"), meta)).toEqual(meta);
    expect(paintOf(screen.getByText("✓"), { color: "" })).toEqual({ color: token("--ink-3") });
  });

  it("writes a nested row in the second ink", () => {
    setTheme(theme);
    render(<PanelRow nested>Report · pass 1</PanelRow>);
    expect(paintOf(screen.getByText("Report · pass 1"), { color: "" })).toEqual({
      color: token("--ink-2"),
    });
  });

  it("is clear at rest and veiled under the pointer when it opens something", async () => {
    setTheme(theme);
    render(<PanelRow onClick={() => {}}>PRD</PanelRow>);
    const row = screen.getByRole("button", { name: "PRD" });
    expect(paintOf(row, { background: "" })).toEqual({ background: TRANSPARENT });
    await userEvent.hover(row);
    expect(paintOf(row, { background: "" })).toEqual({ background: token("--veil-hover") });
  });

  it("shows the focus ring", async () => {
    setTheme(theme);
    render(<PanelRow onClick={() => {}}>PRD</PanelRow>);
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(screen.getByRole("button", { name: "PRD" }), want)).toEqual(want);
  });

  it("is tinted with the brand and ringed when pressed, also under the pointer", async () => {
    setTheme(theme);
    render(
      <>
        <PanelRow pressed onClick={() => {}}>
          PRD
        </PanelRow>
        <PanelRow pressed={false} onClick={() => {}}>
          Tech spec
        </PanelRow>
      </>,
    );
    const row = screen.getByRole("button", { name: "PRD" });
    await userEvent.hover(row);
    const want = {
      background: token("--brand-tint-plane"),
      color: token("--brand-ink"),
      shadow: resolve("inset 0 0 0 var(--border) var(--brand-marker-ring)", "box-shadow"),
    };
    expect(paintOf(row, want)).toEqual(want);
    expect(paintOf(screen.getByRole("button", { name: "Tech spec" }), { shadow: "" })).toEqual({
      shadow: NONE,
    });
  });
});
