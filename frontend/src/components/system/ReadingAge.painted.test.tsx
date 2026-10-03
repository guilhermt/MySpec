import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { ReadingAge } from "./ReadingAge";

const NOW = Date.parse("2026-09-24T14:10:00Z");

describe.each(THEMES)("ReadingAge in the %s theme", (theme) => {
  it("writes the age in the micro size and the fourth ink", () => {
    setTheme(theme);
    render(<ReadingAge readAt="2026-09-24T14:08:00Z" reading={false} now={NOW} />);
    const style = getComputedStyle(screen.getByText("Read 2m ago"));
    expect(style.color).toBe(token("--ink-4"));
    expect(style.fontSize).toBe(resolve("var(--text-micro)", "font-size"));
  });

  it("writes Reading… in the third ink", () => {
    setTheme(theme);
    render(<ReadingAge readAt="" reading now={NOW} />);
    expect(getComputedStyle(screen.getByRole("status")).color).toBe(token("--ink-3"));
  });

  it("writes Not read yet in the fourth ink", () => {
    setTheme(theme);
    render(<ReadingAge readAt="" reading={false} now={NOW} never />);
    expect(getComputedStyle(screen.getByText("Not read yet")).color).toBe(token("--ink-4"));
  });

  it("writes a failed reading in the second ink with the blocked diamond", () => {
    setTheme(theme);
    const { container } = render(
      <ReadingAge
        readAt=""
        reading={false}
        now={NOW}
        failure={{ failedAt: "2026-09-24T13:52:00Z" }}
      />,
    );
    const style = getComputedStyle(screen.getByText("Read failed 18m ago"));
    expect(style.color).toBe(token("--ink-2"));
    expect(style.fontSize).toBe(resolve("var(--text-micro)", "font-size"));
    const glyph = container.querySelector("[data-state='blocked']") as Element;
    expect(getComputedStyle(glyph).borderTopColor).toBe(token("--state-notice"));
  });
});
