import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { DecisionCard } from "./DecisionCard";

function draw() {
  render(
    <DecisionCard
      title="Findings"
      count={2}
      label="Findings of pass 1"
      items={[
        { id: "1", decided: false, disabled: false },
        { id: "2", decided: false, disabled: false },
      ]}
      onDecide={() => "advance"}
      renderItem={(item) => <p>{`Item ${item.id}`}</p>}
    />,
  );
  return screen.getByRole("group", { name: "Findings of pass 1" });
}

describe.each(THEMES)("DecisionCard in the %s theme", (theme) => {
  it("is raised: the second surface with the extra small shadow and the large radius", () => {
    setTheme(theme);
    const card = draw();
    const want = {
      background: token("--surface-2"),
      shadow: resolve("var(--shadow-xs)", "box-shadow"),
    };
    expect(paintOf(card, want)).toEqual(want);
    expect(getComputedStyle(card).borderTopLeftRadius).toBe(resolve("var(--radius-lg)", "width"));
  });

  it("writes the header in the third ink", () => {
    setTheme(theme);
    draw();
    expect(getComputedStyle(screen.getByRole("heading")).color).toBe(token("--ink-3"));
  });

  it("separates the items by the small space", () => {
    setTheme(theme);
    const card = draw();
    expect(getComputedStyle(card).rowGap).toBe(resolve("var(--space-2)", "width"));
  });
});
