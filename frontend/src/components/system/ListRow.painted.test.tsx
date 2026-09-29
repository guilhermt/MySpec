import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { CardRow, type CardRowProps, type CardRowView } from "./ListRow";

const MODEL: CardRowView = {
  key: "acme/api#474",
  number: "#474",
  title: "Usage alerts at 80% of the plan",
  isEpic: false,
  dimmed: false,
  epic: { text: "Usage-based billing", tooltip: "Usage-based billing" },
  dependency: { text: "#461 +1", tooltip: ["Depends on #461"] },
  task: {
    kind: "task",
    glyph: "wait",
    text: "Question · Reviewer · Step 3/7",
    strong: true,
    more: null,
    tooltip: "412-rate-limit: Question",
  },
  canStart: true,
  canDiscuss: true,
  label: "#474 Usage alerts at 80% of the plan",
};

const px = (name: `--${string}`) => parseFloat(resolve(`var(${name})`, "width"));

function draw(width: number, model: Partial<CardRowView> = {}, props: Partial<CardRowProps> = {}) {
  render(
    // The scroll area of the list names the container the row measures itself against.
    <div style={{ width: `${width}px`, containerType: "inline-size", containerName: "list" }}>
      <CardRow
        model={{ ...MODEL, ...model }}
        open={false}
        selection={null}
        tabStop
        flash={false}
        onActivate={() => {}}
        onFocus={() => {}}
        {...props}
      />
    </div>,
  );
  return screen.getByRole("treeitem");
}

const box = (element: Element) => element.getBoundingClientRect();
const cell = (text: string) => screen.getByText(text);

describe.each(THEMES)("CardRow in the %s theme", (theme) => {
  it("is one line of --size-control on a wide list, each part in its column", () => {
    setTheme(theme);
    const row = draw(1200);
    expect(box(row).height).toBe(px("--size-control"));
    const left = box(row).left + px("--space-2");
    const right = box(row).right - px("--space-2");
    const keysStart = right - px("--col-keys");
    expect(box(cell("Usage-based billing")).left).toBeLessThan(box(cell("#461 +1")).left);
    expect(box(cell("#461 +1")).left).toBeLessThan(
      box(cell("Question · Reviewer · Step 3/7")).left,
    );
    // The title keeps at least a third of the row, and the keys keep their column.
    expect(box(cell("Usage alerts at 80% of the plan")).width).toBeGreaterThanOrEqual(1200 / 3);
    expect(box(cell("Question · Reviewer · Step 3/7")).right).toBeLessThanOrEqual(keysStart);
    expect(box(cell("#474")).left).toBe(left + px("--icon") + px("--space-2"));
  });

  it("drops the meta under the title on a narrow list, epic first", () => {
    setTheme(theme);
    const row = draw(900);
    const title = box(cell("Usage alerts at 80% of the plan"));
    for (const text of ["Usage-based billing", "#461 +1", "Question · Reviewer · Step 3/7"]) {
      expect(box(cell(text)).top, text).toBeGreaterThan(title.bottom - 1);
    }
    expect(Number.isInteger(box(row).height)).toBe(true);
    // Epic, dependency, task, left to right.
    expect(box(cell("Usage-based billing")).left).toBeLessThan(box(cell("#461 +1")).left);
    expect(box(cell("#461 +1")).left).toBeLessThan(
      box(cell("Question · Reviewer · Step 3/7")).left,
    );
    expect(box(cell("Usage alerts at 80% of the plan")).left).toBe(
      box(cell("Usage-based billing")).left,
    );
  });

  it("stays on one line, whole width, when there is nothing to drop", () => {
    setTheme(theme);
    const row = draw(900, { epic: null, dependency: null, task: null });
    expect(box(row).height).toBe(px("--size-control"));
  });

  it("gives the second line --space-1-5 above and below", () => {
    setTheme(theme);
    const row = draw(900);
    const title = box(cell("Usage alerts at 80% of the plan"));
    expect(title.top - box(row).top).toBeGreaterThanOrEqual(px("--space-1-5"));
    expect(box(row).height).toBeGreaterThan(px("--size-control"));
  });

  it("shows the keys only with the keyboard focus", async () => {
    setTheme(theme);
    draw(1200);
    const keys = screen.getByText("start").parentElement as HTMLElement;
    expect(getComputedStyle(keys).visibility).toBe("hidden");
    await userEvent.tab();
    expect(getComputedStyle(keys).visibility).toBe("visible");
  });

  it("shows the focus ring", async () => {
    setTheme(theme);
    const row = draw(1200);
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(row, want)).toEqual(want);
  });

  it("paints the open row on the brand plane with its ring", () => {
    setTheme(theme);
    const row = draw(1200, {}, { open: true });
    const want = { background: token("--brand-tint-plane") };
    expect(paintOf(row, want)).toEqual(want);
    expect(getComputedStyle(row).boxShadow).toContain(token("--brand-ring"));
    expect(getComputedStyle(cell("#474")).color).toBe(token("--ink-3"));
  });

  it("steps up on hover", async () => {
    setTheme(theme);
    const row = draw(1200);
    await userEvent.hover(row);
    const want = { background: token("--veil-hover") };
    expect(paintOf(row, want)).toEqual(want);
  });

  it("writes a closed issue of a section that is not final in the fourth ink, the third when open", () => {
    setTheme(theme);
    draw(1200, { dimmed: true });
    expect(getComputedStyle(cell("Usage alerts at 80% of the plan")).color).toBe(token("--ink-4"));
  });

  it("writes the title of a closed card on an open row in the third ink", () => {
    setTheme(theme);
    draw(1200, { dimmed: true }, { open: true });
    expect(getComputedStyle(cell("Usage alerts at 80% of the plan")).color).toBe(token("--ink-3"));
  });

  it("dashes a card that can't be selected", () => {
    setTheme(theme);
    const row = draw(1200, {}, { selection: "can't be selected" });
    const style = getComputedStyle(row);
    expect(style.outlineStyle).toBe("dashed");
    expect(style.outlineColor).toBe(token("--line-3"));
    expect(getComputedStyle(cell("Usage alerts at 80% of the plan")).color).toBe(token("--ink-4"));
  });

  it("draws the rail of a clone that failed, and its text in the error ink", () => {
    setTheme(theme);
    const row = draw(1200, { task: { kind: "clone-failed" } });
    expect(getComputedStyle(row, "::before").backgroundColor).toBe(token("--state-error"));
    expect(getComputedStyle(cell("Clone failed")).color).toBe(token("--state-error"));
  });
});
