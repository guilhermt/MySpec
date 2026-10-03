import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { mainArea, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";
import { SettingsNav } from "./SettingsNav";

function nav(width = 1000) {
  renderWithStore(
    <div style={mainArea(width)}>
      <SettingsNav />
    </div>,
    {
      state: makeState({
        repositories: [makeRepository({ fullName: "acme/infra", missing: true })],
      }),
      ui: { location: { kind: "settings", section: "boards" } },
    },
  );
}

const link = (name: string) => screen.getByRole("link", { name });
const iconOf = (name: string) => link(name).querySelector("svg") as SVGElement;

describe.each(THEMES)("SettingsNav in the %s theme", (theme) => {
  it("tints the open page with the brand plane and the ring stuck to it, its icon in the brand ink and its name in 500", () => {
    setTheme(theme);
    nav();

    const open = link("Boards");
    const want = {
      background: token("--brand-tint-plane"),
      shadow: resolve("inset 0 0 0 var(--border) var(--brand-ring)", "box-shadow"),
      height: resolve("var(--size-control)", "height"),
    };
    expect(paintOf(open, want)).toEqual(want);
    expect(getComputedStyle(open).fontWeight).toBe("500");
    expect(paintOf(iconOf("Boards"), { color: "" })).toEqual({ color: token("--brand-ink") });
  });

  it("leaves another page in the second ink with its icon in the third, veiled under the pointer", async () => {
    setTheme(theme);
    nav();

    const other = link("Defaults");
    expect(paintOf(other, { color: "", background: "" })).toEqual({
      color: token("--ink-2"),
      background: "rgba(0, 0, 0, 0)",
    });
    expect(paintOf(iconOf("Defaults"), { color: "" })).toEqual({ color: token("--ink-3") });

    await userEvent.hover(other);

    expect(paintOf(other, { color: "", background: "" })).toEqual({
      color: token("--ink-1"),
      background: token("--veil-hover"),
    });
  });

  it("rings the focused page outside", async () => {
    setTheme(theme);
    nav();

    await userEvent.tab();

    expect(link("Boards")).toHaveFocus();
    expect(paintOf(link("Boards"), { outline: "", outlineStyle: "" })).toEqual({
      outline: token("--focus"),
      outlineStyle: "solid",
    });
  });

  it("writes the missing clones in the micro size, tabular, in the third ink, and the second on the open page", () => {
    setTheme(theme);
    nav();

    const count = screen.getByText("1");
    const want = { color: token("--ink-3"), fontSize: resolve("var(--text-micro)", "font-size") };
    expect(paintOf(count, want)).toEqual(want);
    expect(getComputedStyle(count).fontVariantNumeric).toContain("tabular-nums");
  });

  it("is a column from 820px of main area", () => {
    setTheme(theme);
    nav(1000);
    expect(getComputedStyle(screen.getByRole("list")).flexDirection).toBe("column");
  });

  it("is a row below 820px of main area", () => {
    setTheme(theme);
    nav(812);
    expect(getComputedStyle(screen.getByRole("list")).flexDirection).toBe("row");
  });
});
