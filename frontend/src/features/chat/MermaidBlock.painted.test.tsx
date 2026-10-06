import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MermaidBlock } from "@/features/chat/MermaidBlock";
import { setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";

vi.mock("@streamdown/mermaid", () => ({
  createMermaidPlugin: () => ({
    getMermaid: () => ({
      initialize: vi.fn(),
      render: vi.fn().mockResolvedValue({
        svg: '<svg viewBox="0 0 800 200" width="100%"><rect width="800" height="200" /></svg>',
      }),
    }),
  }),
}));

describe.each(THEMES)("MermaidBlock in %s", (theme) => {
  it("scrolls the full screen once the zoom passes the width of the dialog", async () => {
    setTheme(theme);
    const user = userEvent.setup();
    renderWithStore(<MermaidBlock source="flowchart LR" closed />);

    await user.click(await screen.findByRole("button", { name: "Full screen" }));
    const dialog = await screen.findByRole("dialog", { name: "Diagram" });
    const area = dialog.querySelector('svg[width="100%"]')?.closest(".overflow-auto");
    if (!(area instanceof HTMLElement)) {
      throw new Error("the full screen has no scroll area");
    }
    expect(area.scrollWidth).toBeLessThanOrEqual(area.clientWidth);

    for (let step = 0; step < 8; step += 1) {
      await user.click(within(dialog).getByRole("button", { name: "Zoom in" }));
    }
    // 3 x 800 = 2400px of diagram, wider than the area in the window of the test.
    expect(area.clientWidth).toBeLessThan(2400);
    expect(area.scrollWidth).toBeGreaterThan(area.clientWidth);
  });
});
