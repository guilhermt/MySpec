import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { ARCHIVED_FACTS, Fact } from "./Facts";

function draw() {
  render(
    <dl className={ARCHIVED_FACTS} style={{ width: "400px" }}>
      <Fact label="Base">dev</Fact>
      <Fact label="Merged by">ana</Fact>
    </dl>,
  );
  return screen.getAllByRole("term");
}

describe.each(THEMES)("ARCHIVED_FACTS in the %s theme", (theme) => {
  it("writes the keys in the third ink and the values in the first, in the meta size", () => {
    setTheme(theme);
    const [key] = draw();
    expect(getComputedStyle(key as Element).color).toBe(token("--ink-3"));
    expect(getComputedStyle(key as Element).fontSize).toBe(
      resolve("var(--text-meta)", "font-size"),
    );
    expect(getComputedStyle(screen.getAllByRole("definition")[0] as Element).color).toBe(
      token("--ink-1"),
    );
  });

  it("sizes the key column to the widest key, --space-5 from the values", () => {
    setTheme(theme);
    const [base, merged] = draw();
    const gap = parseFloat(resolve("var(--space-5)", "width"));
    const values = screen.getAllByRole("definition");
    expect(values[0]?.getBoundingClientRect().left).toBe(
      (merged as Element).getBoundingClientRect().right + gap,
    );
    expect((base as Element).getBoundingClientRect().width).toBe(
      (merged as Element).getBoundingClientRect().width,
    );
  });
});
