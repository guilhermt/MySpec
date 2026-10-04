import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { HistoryRow, type HistoryRowView } from "./ListRow";

const MODEL: HistoryRowView = {
  key: "task:1",
  glyph: "task",
  name: "Idempotency keys for payment intents",
  where: "api#398",
  whereTooltip: "acme/api#398",
  result: "PR #1279 · 6 steps",
  resultStrong: " · dev not updated",
  strongFirst: false,
  time: "15:02",
  label: "Task Idempotency keys for payment intents",
};

const px = (name: `--${string}`) => parseFloat(resolve(`var(${name})`, "width"));
const box = (element: Element) => element.getBoundingClientRect();
const cell = (text: string) => screen.getByText(text);

function draw(width: number, model: Partial<HistoryRowView> = {}, fresh = false) {
  render(
    <div style={{ width: `${width}px`, containerType: "inline-size", containerName: "list" }}>
      <HistoryRow
        model={{ ...MODEL, ...model }}
        fresh={fresh}
        tabStop
        onActivate={() => {}}
        onFocus={() => {}}
      />
    </div>,
  );
  return screen.getByRole("treeitem");
}

describe.each(THEMES)("HistoryRow in the %s theme", (theme) => {
  it("is one line of --size-control on a wide list, each part in its column", () => {
    setTheme(theme);
    const row = draw(1000);
    expect(box(row).height).toBe(px("--size-control"));
    const where = box(cell("api#398"));
    const time = box(cell("15:02"));
    expect(where.left).toBeLessThan(box(cell("PR #1279 · 6 steps")).left);
    expect(box(cell("PR #1279 · 6 steps")).left).toBeLessThan(time.left);
    expect(time.right).toBe(box(row).right - px("--space-2"));
    expect(time.width).toBe(px("--col-time"));
    expect(box(cell("Idempotency keys for payment intents")).right).toBeLessThanOrEqual(where.left);
  });

  it("drops where and the result under the name on a narrow list", () => {
    setTheme(theme);
    const row = draw(764);
    const name = box(cell("Idempotency keys for payment intents"));
    expect(box(cell("api#398")).top).toBeGreaterThanOrEqual(name.bottom);
    expect(box(cell("PR #1279 · 6 steps")).top).toBeGreaterThanOrEqual(name.bottom);
    expect(box(cell("api#398")).left).toBe(name.left);
    expect(box(cell("PR #1279 · 6 steps")).left - box(cell("api#398")).right).toBe(px("--space-4"));
    expect(box(cell("15:02")).top).toBeLessThan(name.bottom);
    expect(Number.isInteger(box(row).height)).toBe(true);
  });

  it("keeps the columns at 860px of the list", () => {
    setTheme(theme);
    const row = draw(860);
    expect(box(row).height).toBe(px("--size-control"));
  });

  it("writes where in the third ink, the result in the second and its strong part in the first at 500", () => {
    setTheme(theme);
    draw(1000);
    expect(getComputedStyle(cell("api#398")).color).toBe(token("--ink-3"));
    expect(getComputedStyle(cell("PR #1279 · 6 steps")).color).toBe(token("--ink-2"));
    const strong = getComputedStyle(screen.getByText(/dev not updated/));
    expect(strong.color).toBe(token("--ink-1"));
    expect(strong.fontWeight).toBe("500");
  });

  it("writes the time in the fourth ink, tabular, to the right", () => {
    setTheme(theme);
    draw(1000);
    const time = getComputedStyle(cell("15:02"));
    expect(time.color).toBe(token("--ink-4"));
    expect(time.fontVariantNumeric).toContain("tabular-nums");
    expect(time.textAlign).toBe("right");
  });

  it("paints the fresh row on the brand plane with its ring, the glyph in the brand ink and the time in the third", () => {
    setTheme(theme);
    const row = draw(1000, {}, true);
    const want = { background: token("--brand-tint-plane") };
    expect(paintOf(row, want)).toEqual(want);
    expect(getComputedStyle(row).boxShadow).toContain(token("--brand-ring"));
    expect(getComputedStyle(row.querySelector("svg") as SVGElement).color).toBe(
      token("--brand-ink"),
    );
    expect(getComputedStyle(cell("15:02")).color).toBe(token("--ink-3"));
  });

  it("steps up on hover and shows the focus ring", async () => {
    setTheme(theme);
    const row = draw(1000);
    await userEvent.hover(row);
    const hover = { background: token("--veil-hover") };
    expect(paintOf(row, hover)).toEqual(hover);
    await userEvent.tab();
    const ring = focusRing();
    expect(paintOf(row, ring)).toEqual(ring);
  });
});
