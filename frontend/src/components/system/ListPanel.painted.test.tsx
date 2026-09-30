import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mainArea, resolve, setTheme, THEMES, token } from "@/test/painted";
import { PanelLayout } from "./AuxPanel";
import { LIST_PANEL_COLUMN_MIN, ListPanel } from "./ListPanel";

// place draws a list with the panel open inside a main area of a fixed width, the container its query measures.
function place(width: number) {
  const { container } = render(
    <div style={{ ...mainArea(width), height: "600px", display: "flex" }}>
      <PanelLayout
        panel={
          <ListPanel
            label="Card #474"
            number="#474"
            repository="acme/api"
            url="https://github.com/acme/api/issues/474"
            onOpenExternal={() => {}}
            onClose={() => {}}
            scrollKey="474"
          >
            <p>The body</p>
          </ListPanel>
        }
      >
        <p>The list</p>
      </PanelLayout>
    </div>,
  );
  const area = (container.firstElementChild as HTMLElement).getBoundingClientRect();
  const panel = screen.getByRole("complementary", { name: "Card #474" });
  // The panel enters sliding in; it is measured where it lands.
  for (const animation of panel.getAnimations()) {
    animation.finish();
  }
  const list = screen.getByText("The list").parentElement as HTMLElement;
  const box = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left - area.left, right: rect.right - area.left, width: rect.width };
  };
  return { panel, box: () => box(panel), list: () => box(list) };
}

describe.each(THEMES)("ListPanel in the %s theme", (theme) => {
  it.each([LIST_PANEL_COLUMN_MIN - 1, LIST_PANEL_COLUMN_MIN, 857, 1200])(
    "is a whole number of pixels wide at %ipx of main area",
    (width) => {
      setTheme(theme);
      const { box } = place(width);
      expect(box().width).toBeGreaterThan(0);
      expect(Number.isInteger(box().width)).toBe(true);
    },
  );

  it("covers the list below 800px of main area", () => {
    setTheme(theme);
    const { panel, box, list } = place(LIST_PANEL_COLUMN_MIN - 1);
    const style = getComputedStyle(panel);
    expect(style.position).toBe("absolute");
    expect(style.backgroundColor).toBe(token("--surface-3"));
    expect(list().width).toBe(LIST_PANEL_COLUMN_MIN - 1);
    expect(box().right).toBe(LIST_PANEL_COLUMN_MIN - 1);
  });

  it("stands beside the list from 800px of main area, where the list keeps 440px", () => {
    setTheme(theme);
    const { panel, box, list } = place(LIST_PANEL_COLUMN_MIN);
    const style = getComputedStyle(panel);
    expect(style.position).toBe("relative");
    expect(style.backgroundColor).toBe(token("--surface-0"));
    expect(style.borderLeftWidth).toBe("1px");
    expect(list().right).toBe(box().left);
    expect(list().width).toBeGreaterThanOrEqual(440);
    expect(box().right).toBe(LIST_PANEL_COLUMN_MIN);
  });

  it("has a head of --size-head with the line drawn inside it", () => {
    setTheme(theme);
    const { panel } = place(1200);
    const head = panel.firstElementChild as HTMLElement;
    expect(`${head.getBoundingClientRect().height}px`).toBe(resolve("var(--size-head)", "height"));
    expect(getComputedStyle(head).boxShadow).toContain(token("--line-1"));
  });
});
