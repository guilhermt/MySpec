import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  offWholePixels,
  paintOf,
  resolve,
  setTheme,
  THEMES,
  TRANSPARENT,
  token,
} from "@/test/painted";
import { BodyDiff } from "./BodyDiff";

function draw() {
  render(
    <div style={{ width: "640px" }}>
      <BodyDiff
        lines={[
          { kind: "same", text: "Bill the overage monthly." },
          { kind: "removed", text: "Cap it at the plan." },
          { kind: "added", text: "Charge past the plan." },
        ]}
      />
    </div>,
  );
  return screen.getByRole("group");
}

describe.each(THEMES)("BodyDiff in the %s theme", (theme) => {
  it("is mono at the meta size on the sunken surface", () => {
    setTheme(theme);
    const diff = draw();
    const want = {
      background: token("--surface-0"),
      fontSize: resolve("var(--text-meta)", "font-size"),
    };
    expect(paintOf(diff, want)).toEqual(want);
    expect(getComputedStyle(diff).fontFamily).toBe(resolve("var(--font-mono)", "font-family"));
  });

  it("lays an added line on the hover veil in the first ink", () => {
    setTheme(theme);
    draw();
    const line = screen.getByText("Charge past the plan.").parentElement as Element;
    const want = { background: token("--veil-hover"), color: token("--ink-1") };
    expect(paintOf(line, want)).toEqual(want);
  });

  it("strikes a removed line in the third ink, with no colour behind it", () => {
    setTheme(theme);
    draw();
    const text = screen.getByText("Cap it at the plan.");
    expect(getComputedStyle(text).textDecorationLine).toBe("line-through");
    expect(getComputedStyle(text).color).toBe(token("--ink-3"));
    expect(getComputedStyle(text.parentElement as Element).backgroundColor).toBe(TRANSPARENT);
  });

  it("lays every box on a whole pixel", () => {
    setTheme(theme);
    const diff = draw();
    expect(offWholePixels([diff, ...diff.querySelectorAll("*")])).toEqual([]);
  });
});
