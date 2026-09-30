import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { ItemBlock } from "./ItemBlock";

function draw() {
  render(
    <ItemBlock
      kind="task"
      name="Add the audit log"
      line2={{ tone: "wait", text: "Question · Reviewer · Step 3/7" }}
      clock={{ kind: "chip", tone: "wait", time: "18m", longTime: "18 minutes" }}
      openLabel="Open the task"
      onOpen={() => {}}
    />,
  );
  return screen.getByText("Add the audit log").closest("div")?.parentElement
    ?.parentElement as HTMLElement;
}

describe.each(THEMES)("ItemBlock in the %s theme", (theme) => {
  it("is raised: the second surface with the extra small shadow and the medium radius", () => {
    setTheme(theme);
    const block = draw();
    const want = {
      background: token("--surface-2"),
      shadow: resolve("var(--shadow-xs)", "box-shadow"),
    };
    expect(paintOf(block, want)).toEqual(want);
    expect(getComputedStyle(block).borderTopLeftRadius).toBe(resolve("var(--radius-md)", "width"));
  });

  it("writes the name at 500 and its type glyph in the brand ink", () => {
    setTheme(theme);
    const block = draw();
    expect(getComputedStyle(screen.getByText("Add the audit log")).fontWeight).toBe("500");
    const glyph = block.querySelector("svg") as SVGElement;
    expect(getComputedStyle(glyph).color).toBe(token("--brand-ink"));
  });

  it("has Open as a secondary button, never the primary", () => {
    setTheme(theme);
    draw();
    expect(screen.getByRole("button", { name: "Open the task" })).toHaveAttribute(
      "data-variant",
      "secondary",
    );
  });
});
