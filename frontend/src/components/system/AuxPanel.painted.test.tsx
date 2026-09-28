import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ICONS } from "@/components/system/icons";
import { mainArea, resolve, setTheme, THEMES, token } from "@/test/painted";
import { AuxPanel, PanelGroup, PanelLayout } from "./AuxPanel";

// place draws a reading column with the panel open inside a main area of a
// fixed width, the container its query measures.
function place(width: number) {
  const { container } = render(
    <div style={{ ...mainArea(width), height: "600px", display: "flex" }}>
      <PanelLayout
        panel={
          <AuxPanel id="artifacts" title="Artifacts" onClose={() => undefined}>
            <p>The body</p>
          </AuxPanel>
        }
      >
        <p>The reading column</p>
      </PanelLayout>
    </div>,
  );
  const area = (container.firstElementChild as HTMLElement).getBoundingClientRect();
  const panel = screen.getByRole("complementary", { name: "Artifacts" });
  // The panel enters sliding in; it is measured where it lands.
  for (const animation of panel.getAnimations()) {
    animation.finish();
  }
  const column = screen.getByText("The reading column").parentElement as HTMLElement;
  // The boxes measured from the left edge of the main area.
  const box = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left - area.left, right: rect.right - area.left, width: rect.width };
  };
  return { panel, box: () => box(panel), column: () => box(column) };
}

describe.each(THEMES)("AuxPanel in the %s theme", (theme) => {
  it.each([1100, 1200])("is a whole number of pixels wide at %ipx of main area", (width) => {
    setTheme(theme);
    const { box } = place(width);

    expect(box().width).toBeGreaterThan(0);
    expect(Number.isInteger(box().width)).toBe(true);
    expect(Number.isInteger(box().left)).toBe(true);
  });

  it("covers the reading column below 1120px of main area", () => {
    setTheme(theme);
    const { panel, box, column } = place(1100);

    const style = getComputedStyle(panel);
    expect(style.position).toBe("absolute");
    expect(style.backgroundColor).toBe(token("--surface-3"));
    expect(column().width).toBe(1100);
    expect(box().right).toBe(1100);
  });

  it("stands beside the reading column from 1120px of main area", () => {
    setTheme(theme);
    const { panel, box, column } = place(1200);

    const style = getComputedStyle(panel);
    expect(style.position).toBe("relative");
    expect(style.backgroundColor).toBe(token("--surface-0"));
    expect(style.borderLeftWidth).toBe("1px");
    expect(column().right).toBe(box().left);
    expect(box().right).toBe(1200);
  });
});

// group draws the buttons of the panels inside a main area of a fixed width.
function group(width: number) {
  render(
    <div style={mainArea(width)}>
      <PanelGroup
        panels={[{ id: "details", label: "Details", tooltip: "The facts", icon: ICONS.details }]}
        open={null}
        onOpenChange={() => undefined}
      />
    </div>,
  );
  return screen.getByRole("button", { name: "Details" }).getBoundingClientRect();
}

describe.each(THEMES)("PanelGroup in the %s theme", (theme) => {
  it("writes the name of a panel beside its icon from 1440px of main area", () => {
    setTheme(theme);
    const button = group(1440);

    expect(button.width).toBeGreaterThan(button.height);
  });

  it("keeps only the icon on a square button below 1440px of main area", () => {
    setTheme(theme);
    const button = group(1439);

    expect(button.width).toBe(button.height);
    expect(`${button.height}px`).toBe(resolve("var(--size-control-sm)", "width"));
  });
});
