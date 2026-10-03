import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  cutTexts,
  focusRing,
  offWholePixels,
  paintOf,
  resolve,
  setTheme,
  THEMES,
  token,
  withoutTooltip,
} from "@/test/painted";
import { FoldedDraft, type FoldedDraftProps } from "./FoldedDraft";

const TITLE = "Overage on the monthly invoice";
const LINE2 = "acme/billing · Billing · In billing#478 Pricing tiers · Depends on Tier limits";

function draw(overrides: Partial<FoldedDraftProps> = {}, width = 720) {
  render(
    <div style={{ width: `${width}px` }}>
      <FoldedDraft
        id="d3"
        number={3}
        kind="New card"
        revised
        title={TITLE}
        muted={false}
        line2={LINE2}
        state={{ text: "Not decided", glyph: null, strong: false, error: false }}
        name="Draft 3 of 5"
        tabStop
        requestTarget={false}
        onOpen={() => {}}
        {...overrides}
      />
    </div>,
  );
  return screen.getByRole("group");
}

/** BOXES are the elements that draw a box: the inside of an icon is a drawing, not a box. */
const BOXES = "*:not(svg *)";

describe.each(THEMES)("FoldedDraft in the %s theme", (theme) => {
  it("writes the title at 500 in the first ink and the second line in the third", () => {
    setTheme(theme);
    draw();
    const title = screen.getByText(TITLE);
    expect(getComputedStyle(title).fontWeight).toBe("500");
    expect(getComputedStyle(title).color).toBe(token("--ink-1"));
    const line2 = screen.getByText(LINE2);
    expect(getComputedStyle(line2).color).toBe(token("--ink-3"));
    expect(getComputedStyle(line2).fontSize).toBe(resolve("var(--text-meta)", "font-size"));
    expect(getComputedStyle(screen.getByText("Not decided").parentElement as Element).color).toBe(
      token("--ink-3"),
    );
  });

  it("writes the title of a discarded draft in the third ink", () => {
    setTheme(theme);
    draw({ muted: true });
    expect(getComputedStyle(screen.getByText(TITLE)).color).toBe(token("--ink-3"));
  });

  it("writes a hold the user takes a way out of in the first ink at 500", () => {
    setTheme(theme);
    draw({
      state: {
        text: "The epic is discarded · this card won't publish",
        glyph: "hold",
        strong: true,
        error: false,
      },
    });
    const state = screen.getByText("The epic is discarded · this card won't publish")
      .parentElement as Element;
    expect(getComputedStyle(state).color).toBe(token("--ink-1"));
    expect(getComputedStyle(state).fontWeight).toBe("500");
  });

  it("steps up on hover", async () => {
    setTheme(theme);
    const folded = draw();
    await userEvent.hover(folded);
    const want = { background: token("--veil-hover") };
    expect(paintOf(folded, want)).toEqual(want);
  });

  it("shows the focus ring when it takes the focus from the keyboard", async () => {
    setTheme(theme);
    const folded = draw();
    await userEvent.tab();
    expect(folded).toHaveFocus();
    const want = focusRing();
    expect(paintOf(folded, want)).toEqual(want);
  });

  it("draws the rail of a failure and writes it in the error ink", () => {
    setTheme(theme);
    const folded = draw({
      state: {
        text: "Couldn't write to GitHub · open it to Retry",
        glyph: "error",
        strong: false,
        error: true,
      },
    });
    expect(getComputedStyle(folded, "::before").backgroundColor).toBe(token("--state-error"));
    const state = screen.getByText("Couldn't write to GitHub · open it to Retry")
      .parentElement as Element;
    expect(getComputedStyle(state).color).toBe(token("--state-error"));
  });

  it("cuts the title and the second line on a narrow card, each with its tooltip", async () => {
    setTheme(theme);
    const folded = draw({}, 360);
    const cut = cutTexts(folded);
    expect(cut.map((element) => element.textContent)).toEqual(
      expect.arrayContaining([TITLE, LINE2]),
    );
    expect(await withoutTooltip(cut)).toEqual([]);
  });

  it("lays every box on a whole pixel", () => {
    setTheme(theme);
    const folded = draw();
    expect(offWholePixels([folded, ...folded.querySelectorAll(BOXES)])).toEqual([]);
  });
});
