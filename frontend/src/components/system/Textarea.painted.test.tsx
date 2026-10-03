import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolve, setTheme, THEMES } from "@/test/painted";
import { Textarea } from "./Textarea";

const field = () => screen.getByRole("textbox", { name: "Notes" });
const lineOf = (leading: `--${string}`) =>
  Number.parseFloat(resolve(`var(${leading})`, "line-height"));
const frame = () =>
  Number.parseFloat(resolve("calc(var(--space-2) * 2 + var(--border) * 2)", "width"));

describe.each(THEMES)("Textarea in the %s theme", (theme) => {
  it("is as high as the composer at least without rows", () => {
    setTheme(theme);
    render(<Textarea aria-label="Notes" />);

    expect(`${field().getBoundingClientRect().height}px`).toBe(
      resolve("var(--size-composer-min)", "height"),
    );
  });

  it("holds its rows in lines of the body leading", () => {
    setTheme(theme);
    render(<Textarea aria-label="Notes" rows={5} />);

    expect(field().getBoundingClientRect().height).toBe(5 * lineOf("--leading-body") + frame());
  });

  it("holds its rows in lines of the leading its text is given, as code", () => {
    setTheme(theme);
    render(
      <Textarea
        aria-label="Notes"
        mono
        rows={4}
        className="text-(length:--text-code) leading-(--leading-code)"
      />,
    );

    expect(field().getBoundingClientRect().height).toBe(4 * lineOf("--leading-code") + frame());
  });

  it("grows past its rows with the text", () => {
    setTheme(theme);
    render(<Textarea aria-label="Notes" rows={2} defaultValue={"1\n2\n3\n4"} />);

    expect(field().getBoundingClientRect().height).toBe(4 * lineOf("--leading-body") + frame());
  });
});
