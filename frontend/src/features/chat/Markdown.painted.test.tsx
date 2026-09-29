import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/features/chat/Markdown";
import { setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";

const LONG = Array.from({ length: 30 }, (_, at) => `line ${at + 1}`).join("\n");

describe.each(THEMES)("Markdown in %s", (theme) => {
  it("puts Copy of a cut block at the end of the block's header, in the header's height", async () => {
    setTheme(theme);
    const { container } = renderWithStore(
      <div style={{ width: 640 }}>
        <Markdown cutCode>{`\`\`\`go\n${LONG}\n\`\`\``}</Markdown>
      </div>,
    );

    const header = container.querySelector('[data-streamdown="code-block-header"]');
    const block = container.querySelector('[data-streamdown="code-block"]');
    if (header === null || block === null) {
      throw new Error("the cut block has no header");
    }
    const copy = (await screen.findByRole("button", { name: "Copy" })).getBoundingClientRect();
    const band = header.getBoundingClientRect();
    const box = block.getBoundingClientRect();

    expect(copy.top).toBeGreaterThanOrEqual(band.top);
    expect(copy.bottom).toBeLessThanOrEqual(band.bottom);
    expect(copy.right).toBeLessThanOrEqual(box.right);
    expect(copy.left).toBeGreaterThan(box.left + box.width / 2);
  });
});
