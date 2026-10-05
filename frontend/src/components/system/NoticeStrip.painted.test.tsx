import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setTheme, THEMES } from "@/test/painted";
import { Button } from "./Button";
import { NoticeStrip } from "./NoticeStrip";

// The list the review panel leaves when the pull request panel is open at 1100, and the narrowest
// list the strip meets, where the action no longer fits beside the text.
const LIST_WIDTH_PX = 452;
const NARROW_WIDTH_PX = 340;

function strip(width = LIST_WIDTH_PX) {
  render(
    <div style={{ width }}>
      <NoticeStrip
        title="Couldn't read guilhermt/myspec · 8m ago"
        reason="gh: HTTP 401: Bad credentials (https://api.github.com/graphql), account guilhermt"
        action={<Button size="xs">Try again</Button>}
      />
    </div>,
  );
  return document.querySelector<HTMLElement>('[data-slot="notice-strip"]') as HTMLElement;
}

describe.each(THEMES)("NoticeStrip in the %s theme", (theme) => {
  it("wraps its text in whole lines, none of a single word", () => {
    setTheme(theme);
    const text = strip().querySelector("p") as HTMLElement;
    const lineHeight = parseFloat(getComputedStyle(text).lineHeight);
    expect(text.getBoundingClientRect().height).toBeLessThanOrEqual(lineHeight * 2 + 1);
    expect(text.getBoundingClientRect().width).toBeGreaterThan(LIST_WIDTH_PX / 2);
  });

  it.each([LIST_WIDTH_PX, NARROW_WIDTH_PX])(
    "drops Try again under the text, at the end, in a list of %i px",
    (width) => {
      setTheme(theme);
      const box = strip(width);
      const text = box.querySelector("p") as HTMLElement;
      const button = screen.getByRole("button", { name: "Try again" }).getBoundingClientRect();
      expect(button.top).toBeGreaterThanOrEqual(text.getBoundingClientRect().bottom);
      const padRight = parseFloat(getComputedStyle(box).paddingRight);
      expect(box.getBoundingClientRect().right - padRight - button.right).toBeLessThanOrEqual(1);
    },
  );
});
