import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { setTheme, THEMES } from "@/test/painted";
import { Tooltip } from "./Tooltip";

/** NAME is a name longer than the tooltip is wide, as an item of the collapsed rail has. */
const NAME = "fix-typo-in-the-footer-of-the-landing-page-and-the-docs";

describe.each(THEMES)("Tooltip in the %s theme", (theme) => {
  it("puts the sub under the content, at its start, so the content keeps the whole width", async () => {
    setTheme(theme);
    render(
      <Tooltip content={<span>{NAME}</span>} sub="Session error · Reviewer · Step 1/1">
        <button type="button">Rail block</button>
      </Tooltip>,
    );

    await userEvent.hover(screen.getByRole("button", { name: "Rail block" }));
    const tooltip = await screen.findByRole("tooltip");
    const name = screen.getByText(NAME).getBoundingClientRect();
    const sub = screen.getByText("Session error · Reviewer · Step 1/1").getBoundingClientRect();

    expect(sub.left).toBe(name.left);
    expect(sub.top).toBeGreaterThanOrEqual(name.bottom);
    expect(Math.round(name.width)).toBe(
      Math.round(
        tooltip.clientWidth -
          Number.parseFloat(getComputedStyle(tooltip).paddingLeft) -
          Number.parseFloat(getComputedStyle(tooltip).paddingRight),
      ),
    );
  });
});
