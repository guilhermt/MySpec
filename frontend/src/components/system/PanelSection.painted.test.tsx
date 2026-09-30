import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { PanelSection } from "./PanelSection";

describe.each(THEMES)("PanelSection in the %s theme", (theme) => {
  it("writes the legend in capitals, in the third ink and the caps type", () => {
    setTheme(theme);
    render(
      <PanelSection legend="Task">
        <p>Branch</p>
      </PanelSection>,
    );
    const legend = screen.getByRole("heading", { name: "Task" });
    const want = {
      color: token("--ink-3"),
      fontSize: resolve("var(--text-caps)", "font-size"),
    };
    expect(paintOf(legend, want)).toEqual(want);
    expect(getComputedStyle(legend).textTransform).toBe("uppercase");
  });
});
