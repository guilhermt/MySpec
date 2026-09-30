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
});
