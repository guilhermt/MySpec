import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { mainArea, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makePrompt, makeState } from "@/test/wails-mock";
import { PromptEditor } from "./PromptEditor";

function editor(width: number, text = "Write it better.") {
  renderWithStore(
    <div style={mainArea(width)}>
      <PromptEditor stage="prd" prompt={makePrompt()} onSaved={() => {}} />
    </div>,
    {
      state: makeState(),
      ui: {
        location: { kind: "settings", section: "prd" },
        promptEdit: { stage: "prd", original: "Write it.", text },
      },
    },
  );
}

const column = () => screen.getByRole("complementary", { name: "Placeholders" });
const bar = () => screen.getByText("Unsaved changes").parentElement as HTMLElement;

/** places is where the bar's first text and its two buttons stand, from the bar's left and right edges. */
function places() {
  const cancel = screen.getByRole("button", { name: "Cancel" });
  const foot = cancel.parentElement?.parentElement as HTMLElement;
  const box = foot.getBoundingClientRect();
  const right = (element: Element) => box.right - element.getBoundingClientRect().right;
  return {
    text: (foot.firstElementChild as HTMLElement).getBoundingClientRect().left - box.left,
    cancel: right(cancel),
    save: right(screen.getByRole("button", { name: /^Save/ })),
  };
}

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

  it("keeps Cancel and Save in place with the reason on the left and without it", async () => {
    setTheme(theme);
    editor(1000, "Write it.");
    const reason = screen.getByText("Nothing changed yet.");
    const before = places();

    expect(reason.getBoundingClientRect().right).toBeLessThan(
      screen.getByRole("button", { name: "Cancel" }).getBoundingClientRect().left,
    );
    await userEvent.type(screen.getByRole("textbox", { name: "PRD prompt" }), "!");
    expect(screen.getByText("Unsaved changes")).toBeVisible();
    expect(places()).toEqual(before);
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
