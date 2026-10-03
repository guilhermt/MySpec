import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/features/chat/Markdown";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";

const LONG = Array.from({ length: 30 }, (_, at) => `line ${at + 1}`).join("\n");

describe.each(THEMES)("Markdown in %s", (theme) => {
  it("draws the headings of the body of a draft at the size of the UI, in 600", async () => {
    setTheme(theme);
    renderWithStore(<Markdown className="draft-body">{"## Context\n\nThe invoice."}</Markdown>);

    const heading = await screen.findByRole("heading", { name: "Context" });
    const style = getComputedStyle(heading);
    expect([style.fontSize, style.lineHeight, style.fontWeight]).toEqual([
      resolve("var(--text-ui)", "font-size"),
      resolve("var(--leading-ui)", "line-height"),
      "600",
    ]);
  });

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

  it("keeps the foot of a cut block inside the sunken block, under a rule", async () => {
    setTheme(theme);
    const { container } = renderWithStore(
      <div style={{ width: 640 }}>
        <Markdown cutCode>{`\`\`\`go\n${LONG}\n\`\`\``}</Markdown>
      </div>,
    );

    const show = await screen.findByRole("button", { name: "Show all 30 lines" });
    await expect
      .poll(() => container.querySelector('[data-streamdown="code-block-body"] code'))
      .not.toBeNull();
    const frame = container.querySelector<HTMLElement>("[data-code-cut]");
    const code = container.querySelector('[data-streamdown="code-block"]');
    if (frame === null || code === null) {
      throw new Error("the cut block is not drawn");
    }
    expect(paintOf(frame, { background: "" })).toEqual({ background: token("--surface-0") });
    const box = frame.getBoundingClientRect();
    const inner = code.getBoundingClientRect();
    expect([inner.top, inner.left, inner.right]).toEqual([box.top, box.left, box.right]);
    const foot = show.parentElement;
    if (foot === null) {
      throw new Error("the foot is not drawn");
    }
    const row = foot.getBoundingClientRect();
    expect(row.top).toBeGreaterThanOrEqual(inner.bottom);
    expect(row.bottom).toBe(box.bottom);
    expect([row.left, row.right]).toEqual([box.left, box.right]);
  });
});
