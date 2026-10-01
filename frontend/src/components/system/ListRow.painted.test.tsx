import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, paintOf, resolve, setTheme, spillsOut, THEMES, token } from "@/test/painted";
import {
  CardRow,
  type CardRowProps,
  type CardRowView,
  PullRequestRow,
  type PullRequestRowProps,
  type PullRequestRowState,
  type PullRequestRowView,
} from "./ListRow";

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
    // S start and D discuss fit inside the column of the keys, which is where the cell starts.
    const keys = row.lastElementChild as Element;
    expect(box(keys).left).toBe(keysStart);
    expect(spillsOut(keys)).toBe(false);
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

const REVIEW: Extract<PullRequestRowState, { kind: "review" }> = {
  kind: "review",
  glyph: "wait",
  long: "Decide findings · pass 1 · 1/3",
  short: "Decide findings",
  strong: true,
  tooltip: "The review waits for you",
};

const PR: PullRequestRowView = {
  key: "acme/web#2291",
  reference: "web#2291",
  referenceTooltip: "acme/web#2291",
  title: "Move the billing page to the new layout",
  tags: [{ text: "Draft", tooltip: null }],
  folded: { text: "+1", tooltip: "Draft" },
  author: "dependabot",
  state: REVIEW,
  keys: "review",
  dashed: false,
  label: "web#2291 Move the billing page to the new layout",
};

function drawPR(
  width: number,
  model: Partial<PullRequestRowView> = {},
  props: Partial<PullRequestRowProps> = {},
) {
  render(
    <div style={{ width: `${width}px`, containerType: "inline-size", containerName: "list" }}>
      <PullRequestRow
        model={{ ...PR, ...model }}
        open={false}
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

/** shown is the visible cell of a text, not the invisible measure of the long form. */
const shown = (text: string) =>
  screen.getAllByText(text).find((element) => element.getAttribute("aria-hidden") !== "true") as
    | HTMLElement
    | undefined;

describe.each(THEMES)("PullRequestRow in the %s theme", (theme) => {
  it("is one line of --size-control on a wide list, each part in its column", () => {
    setTheme(theme);
    const row = drawPR(1200);
    expect(box(row).height).toBe(px("--size-control"));
    const left = box(row).left + px("--space-2");
    const right = box(row).right - px("--space-2");
    const keysStart = right - px("--col-keys");
    const stateStart = keysStart - px("--space-2") - px("--col-state");
    const authorStart = stateStart - px("--space-2") - px("--col-author");
    expect(box(cell("web#2291")).left).toBe(left);
    expect(box(cell("dependabot")).left).toBe(authorStart);
    expect(box(shown("Decide findings · pass 1 · 1/3") as Element).right).toBeLessThanOrEqual(
      keysStart,
    );
    expect(box(cell("Move the billing page to the new layout")).left).toBeLessThan(
      box(cell("Draft")).left,
    );
    const keys = row.lastElementChild as Element;
    expect(box(keys).left).toBe(keysStart);
    expect(spillsOut(keys)).toBe(false);
  });

  it("drops the author and the state under the title on a narrow list", () => {
    setTheme(theme);
    const row = drawPR(900);
    const title = box(cell("Move the billing page to the new layout"));
    expect(box(cell("dependabot")).top).toBeGreaterThan(title.bottom - 1);
    expect(box(cell("dependabot")).left).toBe(title.left);
    const state = shown("Decide findings · pass 1 · 1/3") as Element;
    expect(box(state).top).toBeGreaterThan(title.bottom - 1);
    expect(box(state).left).toBeGreaterThan(box(cell("dependabot")).right + px("--space-4") - 1);
    expect(Number.isInteger(box(row).height)).toBe(true);
    expect(title.top - box(row).top).toBeGreaterThanOrEqual(px("--space-1-5"));
  });

  // The second line starts at 1040px of list and below: the last width on one line, then the first on two.
  it.each([
    [1041, false],
    [1040, true],
  ])("at a list of %ipx puts the author and the state on a second line: %s", (width, second) => {
    setTheme(theme);
    const row = drawPR(width);
    const title = box(cell("Move the billing page to the new layout"));
    const author = box(cell("dependabot"));
    const state = box(shown("Decide findings · pass 1 · 1/3") as Element);
    expect(box(row).height > px("--size-control")).toBe(second);
    for (const part of [author, state]) {
      if (second) {
        expect(part.top).toBeGreaterThan(title.bottom - 1);
      } else {
        expect(part.top).toBeLessThan(title.bottom);
        expect(part.left).toBeGreaterThan(title.right - 1);
      }
    }
  });

  it("takes the short form of a review that does not fit its column", () => {
    setTheme(theme);
    drawPR(1200, {
      state: {
        ...REVIEW,
        long: "Decide findings · pass 1 · 1/3 · waiting for you since the morning",
      },
    });
    expect(shown("Decide findings")).toBeDefined();
  });

  it("writes the reference in the fourth ink, the third when open", () => {
    setTheme(theme);
    drawPR(1200);
    expect(getComputedStyle(cell("web#2291")).color).toBe(token("--ink-4"));
    expect(getComputedStyle(cell("web#2291")).fontVariantNumeric).toBe("tabular-nums");
  });

  it("paints the open row on the brand plane with its ring", () => {
    setTheme(theme);
    const row = drawPR(1200, {}, { open: true });
    const want = { background: token("--brand-tint-plane") };
    expect(paintOf(row, want)).toEqual(want);
    expect(getComputedStyle(row).boxShadow).toContain(token("--brand-ring"));
    expect(getComputedStyle(cell("web#2291")).color).toBe(token("--ink-3"));
  });

  it("outlines a tag in the second line, micro, without cutting it", () => {
    setTheme(theme);
    drawPR(1200);
    const tag = cell("Draft");
    expect(paintOf(tag, { border: "" })).toEqual({ border: token("--line-2") });
    expect(getComputedStyle(tag).fontSize).toBe(resolve("var(--text-micro)", "font-size"));
    expect(tag.scrollWidth).toBeLessThanOrEqual(tag.clientWidth);
  });

  // The title, longer than a third of the row at the narrow lists, keeps that third: the tags give
  // way first, folded into +3 and then gone, and none of them cuts.
  it.each([
    [1200, ["Draft", "dependencies", "+1"]],
    [600, ["+3"]],
    [400, []],
  ])("at a list of %ipx shows the tags %j beside the title", (width, tags) => {
    setTheme(theme);
    const row = drawPR(width, {
      tags: [
        { text: "Draft", tooltip: null },
        { text: "dependencies", tooltip: null },
        { text: "+1", tooltip: "dependabot\ndependencies" },
      ],
      folded: { text: "+3", tooltip: "Draft\ndependabot\ndependencies" },
    });
    const title = cell("Move the billing page to the new layout");
    const column = title.parentElement as HTMLElement;
    expect([...(title.nextElementSibling?.children ?? [])].map((tag) => tag.textContent)).toEqual(
      tags,
    );
    expect(box(title).width).toBeGreaterThanOrEqual(
      Math.min(title.scrollWidth, box(row).width / 3),
    );
    expect(spillsOut(column)).toBe(false);
  });

  it("writes the author in the third ink", () => {
    setTheme(theme);
    drawPR(1200);
    expect(getComputedStyle(cell("dependabot")).color).toBe(token("--ink-3"));
  });

  it("writes a strong review in the first ink, 500", () => {
    setTheme(theme);
    drawPR(1200);
    const strong = shown("Decide findings · pass 1 · 1/3") as HTMLElement;
    expect(getComputedStyle(strong).color).toBe(token("--ink-1"));
    expect(getComputedStyle(strong).fontWeight).toBe("500");
  });

  it("writes a quiet review in the second ink, 400", () => {
    setTheme(theme);
    drawPR(1200, { state: { ...REVIEW, strong: false } });
    const quiet = shown("Decide findings · pass 1 · 1/3") as HTMLElement;
    expect(getComputedStyle(quiet).color).toBe(token("--ink-2"));
    expect(getComputedStyle(quiet).fontWeight).toBe("400");
  });

  it("writes a text state in the tone it is given", () => {
    setTheme(theme);
    drawPR(1200, {
      state: { kind: "text", text: "Not reviewed", tone: "ink-3", tooltip: null },
    });
    expect(getComputedStyle(cell("Not reviewed")).color).toBe(token("--ink-3"));
  });

  it("shows the keys only with the keyboard focus", async () => {
    setTheme(theme);
    drawPR(1200);
    const keys = screen.getByText("review").closest("[aria-hidden]") as HTMLElement;
    expect(getComputedStyle(keys).visibility).toBe("hidden");
    await userEvent.tab();
    expect(getComputedStyle(keys).visibility).toBe("visible");
  });

  it("shows the focus ring", async () => {
    setTheme(theme);
    const row = drawPR(1200);
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(row, want)).toEqual(want);
  });

  it("steps up on hover", async () => {
    setTheme(theme);
    const row = drawPR(1200);
    await userEvent.hover(row);
    const want = { background: token("--veil-hover") };
    expect(paintOf(row, want)).toEqual(want);
  });

  it("dashes a row from a fork and writes its title in the fourth ink", () => {
    setTheme(theme);
    const row = drawPR(1200, { dashed: true });
    const style = getComputedStyle(row);
    expect(style.outlineStyle).toBe("dashed");
    expect(style.outlineColor).toBe(token("--line-3"));
    expect(getComputedStyle(cell("Move the billing page to the new layout")).color).toBe(
      token("--ink-4"),
    );
  });

  it("draws the rail of a clone that failed, and its text in the error ink", () => {
    setTheme(theme);
    const row = drawPR(1200, { state: { kind: "clone-failed" } });
    expect(getComputedStyle(row, "::before").backgroundColor).toBe(token("--state-error"));
    expect(getComputedStyle(cell("Clone failed")).color).toBe(token("--state-error"));
  });
});
