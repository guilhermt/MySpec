import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GestureLineView } from "@/components/system/draft-views";
import { offWholePixels, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { GestureLine } from "./GestureLine";

const VIEW: GestureLineView = {
  icon: "chain",
  segments: [
    { text: "Approve", strong: true },
    { text: " publishes the epic and this card to GitHub now.", strong: false },
  ],
  text: "Approve publishes the epic and this card to GitHub now.",
};

function draw() {
  render(
    <div style={{ width: "640px" }}>
      <GestureLine id="gesture" view={VIEW} />
    </div>,
  );
  return document.getElementById("gesture") as HTMLElement;
}

/** BOXES are the elements that draw a box: the inside of an icon is a drawing, not a box. */
const BOXES = "*:not(svg *)";

describe.each(THEMES)("GestureLine in the %s theme", (theme) => {
  it("is sunk into the surface, in the second ink at the meta size", () => {
    setTheme(theme);
    const line = draw();
    const want = {
      background: token("--surface-0"),
      color: token("--ink-2"),
      fontSize: resolve("var(--text-meta)", "font-size"),
    };
    expect(paintOf(line, want)).toEqual(want);
    expect(getComputedStyle(line).borderTopLeftRadius).toBe(resolve("var(--radius-sm)", "width"));
  });

  it("writes Approve at 600 and draws the icon in the third ink", () => {
    setTheme(theme);
    const line = draw();
    expect(getComputedStyle(screen.getByText("Approve")).fontWeight).toBe("600");
    expect(getComputedStyle(line.querySelector("svg") as Element).color).toBe(token("--ink-3"));
  });

  it("lays every box on a whole pixel", () => {
    setTheme(theme);
    const line = draw();
    expect(offWholePixels([line, ...line.querySelectorAll(BOXES)])).toEqual([]);
  });
});
