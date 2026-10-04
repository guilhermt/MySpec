import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { ICONS } from "./icons";
import { Toast } from "./Toast";

function draw(detail?: string) {
  render(
    <Toast
      icon={ICONS.archive}
      text="“add-login” was archived"
      {...(detail !== undefined ? { detail } : {})}
      action={{ label: "Open in History", onClick: vi.fn() }}
      onDismiss={vi.fn()}
    />,
  );
}

describe.each(THEMES)("Toast in the %s theme", (theme) => {
  it("floats on the third surface, up to --size-toast", () => {
    setTheme(theme);
    draw("Closed at 15:02");
    const toast = screen.getByText("“add-login” was archived").closest(".toast") as Element;
    const style = getComputedStyle(toast);
    expect(style.backgroundColor).toBe(token("--surface-3"));
    expect(parseFloat(style.maxWidth)).toBe(parseFloat(resolve("var(--size-toast)", "width")));
  });

  it("writes the detail in the meta size and the third ink, under the text and above the action", () => {
    setTheme(theme);
    draw("Closed at 15:02");
    const detail = screen.getByText("Closed at 15:02");
    const style = getComputedStyle(detail);
    expect(style.color).toBe(token("--ink-3"));
    expect(style.fontSize).toBe(resolve("var(--text-meta)", "font-size"));
    expect(detail.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      screen.getByText("“add-login” was archived").getBoundingClientRect().bottom,
    );
    expect(detail.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      screen.getByRole("button", { name: "Open in History" }).getBoundingClientRect().top,
    );
  });

  it("wraps a long detail inside the toast", () => {
    setTheme(theme);
    draw(
      "Closed at 15:02 · dev not updated: another branch is checked out in the clone of the repository",
    );
    const detail = screen.getByText(/dev not updated/);
    expect(detail.getBoundingClientRect().height).toBeGreaterThan(
      parseFloat(resolve("var(--leading-meta)", "height")),
    );
    expect(detail.scrollWidth).toBeLessThanOrEqual(detail.clientWidth);
  });
});
