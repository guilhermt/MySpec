import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { type TabItem, Tabs } from "./Tabs";

type Agent = "implementer" | "reviewer";

function tabs(reviewer: Partial<TabItem<Agent>> = {}) {
  render(
    <Tabs
      label="Agents"
      value="implementer"
      onValueChange={() => {}}
      controls="conversation"
      items={[
        { id: "implementer", label: "Implementer", accessibleName: "Implementer: working" },
        { id: "reviewer", label: "Reviewer", accessibleName: "Reviewer", ...reviewer },
      ]}
    />,
  );
}

describe.each(THEMES)("Tabs in the %s theme", (theme) => {
  it("is a band of --size-tab over the first line", () => {
    setTheme(theme);
    tabs();
    const list = screen.getByRole("tablist");
    const want = {
      height: "28px",
      shadow: resolve("inset 0 calc(var(--border) * -1) 0 var(--line-1)", "box-shadow"),
    };
    expect(paintOf(list, want)).toEqual(want);
    expect(getComputedStyle(list).columnGap).toBe("20px");
  });

  it("writes the chosen tab in the first ink, semibold, with the brand underline", () => {
    setTheme(theme);
    tabs();
    const chosen = screen.getByRole("tab", { name: "Implementer: working" });
    expect(paintOf(chosen, { color: "" })).toEqual({ color: token("--ink-1") });
    expect(getComputedStyle(chosen).fontWeight).toBe("600");
    const underline = getComputedStyle(chosen, "::after");
    expect(underline.backgroundColor).toBe(token("--brand"));
    expect(underline.height).toBe("2px");
  });

  it("writes the other tab in the third ink, and the first under the pointer", async () => {
    setTheme(theme);
    tabs();
    const other = screen.getByRole("tab", { name: "Reviewer" });
    expect(paintOf(other, { color: "" })).toEqual({ color: token("--ink-3") });
    await userEvent.hover(other);
    await expect.poll(() => getComputedStyle(other).color).toBe(token("--ink-1"));
  });

  it.each([
    ["wait", "--state-wait"],
    ["error", "--state-error"],
  ] as const)("says the %s word in its state color", (tone, color) => {
    setTheme(theme);
    tabs({ word: { text: tone === "wait" ? "waits" : "error", tone } });
    const word = screen.getByText(tone === "wait" ? "· waits" : "· error");
    expect(paintOf(word, { color: "" })).toEqual({ color: token(color) });
    expect(getComputedStyle(word).fontWeight).toBe("500");
  });

  it("dashes a disabled tab in the fourth ink", () => {
    setTheme(theme);
    tabs({ disabled: true, disabledLabel: "starts with pass 1" });
    const disabled = screen.getByRole("tab", { name: "Reviewer" });
    const want = { color: token("--ink-4"), outline: token("--line-3"), outlineStyle: "dashed" };
    expect(paintOf(disabled, want)).toEqual(want);
  });

  it("draws the focus ring inside the tab", async () => {
    setTheme(theme);
    tabs();
    await userEvent.keyboard("{Tab}");
    const chosen = screen.getByRole("tab", { name: "Implementer: working" });
    const want = { outline: token("--focus"), outlineStyle: "solid" };
    expect(paintOf(chosen, want)).toEqual(want);
    expect(Number.parseFloat(getComputedStyle(chosen).outlineOffset)).toBeLessThan(0);
  });
});
