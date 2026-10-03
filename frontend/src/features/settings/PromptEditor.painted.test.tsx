import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mainArea, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makePrompt, makeState } from "@/test/wails-mock";
import { PromptEditor } from "./PromptEditor";

function editor(width: number) {
  renderWithStore(
    <div style={mainArea(width)}>
      <PromptEditor stage="prd" prompt={makePrompt()} onSaved={() => {}} />
    </div>,
    {
      state: makeState(),
      ui: {
        location: { kind: "settings", section: "prd" },
        promptEdit: { stage: "prd", original: "Write it.", text: "Write it better." },
      },
    },
  );
}

const column = () => screen.getByRole("complementary", { name: "Placeholders" });
const bar = () => screen.getByText("Unsaved changes").parentElement as HTMLElement;

describe.each(THEMES)("PromptEditor in the %s theme", (theme) => {
  it("gives the Placeholders column 288px beside the text from 820px of main area", () => {
    setTheme(theme);
    editor(1000);

    expect(column().getBoundingClientRect().width).toBe(288);
    expect(getComputedStyle(column()).position).toBe("sticky");
    const field = screen.getByRole("textbox", { name: "PRD prompt" });
    expect(column().getBoundingClientRect().left).toBeGreaterThan(
      field.getBoundingClientRect().right,
    );
  });

  it("drops the column under the text, no longer sticky, below 820px", () => {
    setTheme(theme);
    editor(812);

    const field = screen.getByRole("textbox", { name: "PRD prompt" });
    expect(column().getBoundingClientRect().top).toBeGreaterThanOrEqual(
      field.getBoundingClientRect().bottom,
    );
    expect(getComputedStyle(column()).position).not.toBe("sticky");
  });

  it("writes the text in the code size, mono, with no ligatures, at least 24 lines high", () => {
    setTheme(theme);
    editor(1000);

    const field = screen.getByRole("textbox", { name: "PRD prompt" });
    const style = getComputedStyle(field);
    expect(style.fontSize).toBe(resolve("var(--text-code)", "font-size"));
    expect(style.fontFamily).toBe(resolve("var(--font-mono)", "font-family"));
    expect(style.fontVariantLigatures).toBe("none");
    expect(field.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      24 * Number.parseFloat(resolve("var(--leading-code)", "line-height")),
    );
  });

  it("sticks the bar to the foot with the first surface and a rule on top", () => {
    setTheme(theme);
    editor(1000);

    const want = {
      background: token("--surface-1"),
      shadow: resolve("inset 0 var(--border) 0 var(--line-1)", "box-shadow"),
    };
    expect(getComputedStyle(bar()).position).toBe("sticky");
    expect(getComputedStyle(bar()).bottom).toBe("0px");
    expect(paintOf(bar(), want)).toEqual(want);
  });
});
