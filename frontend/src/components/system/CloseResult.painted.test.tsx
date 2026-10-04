import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { CloseResult, type CloseResultLine } from "./CloseResult";

const LINES: CloseResultLine[] = [
  { outcome: "done", text: "Worktree removed" },
  { outcome: "skipped", text: "Worktree was already gone", after: "Nothing to do." },
  { outcome: "failed", text: "dev not updated", detail: "fatal: not a fast-forward" },
];

function draw() {
  render(<CloseResult legend="Closing" time="15:02" label="What the closing did" lines={LINES} />);
  return screen.getByRole("group");
}

describe.each(THEMES)("CloseResult in the %s theme", (theme) => {
  it("sinks the block with its paddings", () => {
    setTheme(theme);
    const style = getComputedStyle(draw());
    expect(style.backgroundColor).toBe(token("--surface-0"));
    expect(style.borderTopLeftRadius).toBe(resolve("var(--radius-md)", "border-top-left-radius"));
    expect(style.paddingTop).toBe(resolve("var(--space-2)", "padding-top"));
    expect(style.paddingLeft).toBe(resolve("var(--space-4)", "padding-left"));
    expect(style.paddingBottom).toBe(resolve("var(--space-2-5)", "padding-bottom"));
  });

  it("writes the legend in capitals at 700 and the time in the fourth ink", () => {
    setTheme(theme);
    draw();
    const legend = getComputedStyle(screen.getByText("Closing"));
    expect(legend.textTransform).toBe("uppercase");
    expect(legend.fontWeight).toBe("700");
    expect(legend.color).toBe(token("--ink-3"));
    expect(getComputedStyle(screen.getByText("15:02")).color).toBe(token("--ink-4"));
  });

  it("writes done in the first ink, skipped in the second, with the after in the third", () => {
    setTheme(theme);
    draw();
    expect(getComputedStyle(screen.getByText("Worktree removed")).color).toBe(token("--ink-1"));
    expect(getComputedStyle(screen.getByText("Worktree was already gone")).color).toBe(
      token("--ink-2"),
    );
    expect(getComputedStyle(screen.getByText("Nothing to do.")).color).toBe(token("--ink-3"));
    const dash = getComputedStyle(screen.getByText("–"));
    expect(dash.fontWeight).toBe("700");
    expect(dash.color).toBe(token("--ink-3"));
  });

  it("writes what git said in mono at the micro size, and rules the lines apart", () => {
    setTheme(theme);
    draw();
    const detail = getComputedStyle(screen.getByText("fatal: not a fast-forward"));
    expect(detail.fontFamily).toBe(resolve("var(--font-mono)", "font-family"));
    expect(detail.fontSize).toBe(resolve("var(--text-micro)", "font-size"));
    const [first, second] = screen.getAllByRole("listitem");
    expect(getComputedStyle(first as Element).borderTopWidth).toBe("0px");
    expect(getComputedStyle(second as Element).borderTopColor).toBe(token("--line-1"));
  });
});
