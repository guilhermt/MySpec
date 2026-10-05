import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { KeyNotice, type KeyNoticeState } from "./KeyNotice";
import { TOOLTIP_OFFSET_PX } from "./Tooltip";

const TEXT = { title: "No task from #412", reason: "#412 already has a task." };

async function draw() {
  render(<button type="button">Row</button>);
  const anchor = screen.getByRole("button", { name: "Row" });
  const notice: KeyNoticeState = { id: 1, anchor, text: TEXT };
  await act(async () => {
    render(<KeyNotice notice={notice} onHide={() => {}} />);
  });
  // The notice on screen is the popup, which only the eye reads; the reader hears the region.
  const popup = (await screen.findByText(TEXT.title)).parentElement as HTMLElement;
  return { anchor, status: popup };
}

describe.each(THEMES)("KeyNotice in the %s theme", (theme) => {
  it("paints the surface of the tooltip", async () => {
    setTheme(theme);
    const { status } = await draw();
    const style = getComputedStyle(status);
    expect(style.backgroundColor).toBe(token("--tooltip-surface"));
    expect(style.borderRadius).toBe(resolve("var(--radius-sm)", "width"));
    expect(status.getBoundingClientRect().width).toBeLessThanOrEqual(
      parseFloat(resolve("var(--size-tooltip-max)", "width")),
    );
  });

  it("stands over a tooltip and is read from a region of its own", async () => {
    setTheme(theme);
    const { status } = await draw();
    expect(status).toHaveAttribute("aria-hidden", "true");
    expect(getComputedStyle(status.parentElement as Element).zIndex).toBe(
      resolve("var(--z-tooltip)", "z-index"),
    );
    expect(screen.getByRole("status")).toHaveTextContent(`${TEXT.title} · ${TEXT.reason}`);
  });

  it("writes the title at 600 and the reason in the second ink", async () => {
    setTheme(theme);
    const { status } = await draw();
    const title = screen.getByText(TEXT.title);
    expect(getComputedStyle(title).color).toBe(token("--tooltip-ink"));
    expect(getComputedStyle(title).fontWeight).toBe("600");
    const reason = screen.getByText(`· ${TEXT.reason}`);
    expect(getComputedStyle(reason).color).toBe(token("--tooltip-ink-2"));
    expect(status).toHaveTextContent(`${TEXT.title} · ${TEXT.reason}`);
  });

  it("sits below its anchor by the tooltip offset, on whole pixels", async () => {
    setTheme(theme);
    const { anchor, status } = await draw();
    const box = status.getBoundingClientRect();
    expect(box.top - anchor.getBoundingClientRect().bottom).toBe(TOOLTIP_OFFSET_PX);
    expect(Number.isInteger(box.top)).toBe(true);
    expect(Number.isInteger(box.left)).toBe(true);
  });
});
