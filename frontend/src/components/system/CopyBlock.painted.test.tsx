import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { CopyBlock } from "./CopyBlock";

describe.each(THEMES)("CopyBlock in the %s theme", (theme) => {
  it("sinks the block, with the label in the micro size and the third ink", () => {
    setTheme(theme);
    const { container } = render(
      <CopyBlock label="error" copyLabel="Copy the error" text="boom" />,
    );
    const block = getComputedStyle(container.firstElementChild as Element);
    expect(block.backgroundColor).toBe(token("--surface-0"));
    expect(block.borderTopLeftRadius).toBe(resolve("var(--radius-md)", "border-top-left-radius"));
    const label = getComputedStyle(screen.getByText("error"));
    expect(label.color).toBe(token("--ink-3"));
    expect(label.fontSize).toBe(resolve("var(--text-micro)", "font-size"));
    expect(label.textTransform).toBe("uppercase");
  });

  it("writes the text in mono, wrapping, in the first ink", () => {
    setTheme(theme);
    render(<CopyBlock label="error" copyLabel="Copy the error" text="boom" />);
    const text = getComputedStyle(screen.getByText("boom"));
    expect(text.fontFamily).toBe(resolve("var(--font-mono)", "font-family"));
    expect(text.fontSize).toBe(resolve("var(--text-code)", "font-size"));
    expect(text.whiteSpace).toBe("pre-wrap");
    expect(text.color).toBe(token("--ink-1"));
  });
});
