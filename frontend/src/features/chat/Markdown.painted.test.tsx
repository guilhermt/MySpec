import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/features/chat/Markdown";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";

const LONG = Array.from({ length: 30 }, (_, at) => `line ${at + 1}`).join("\n");

describe.each(THEMES)("Markdown in %s", (theme) => {
  it("draws the headings under a title of its own at the size of the UI, in 600", async () => {
    setTheme(theme);
    renderWithStore(<Markdown className="ui-headings">{"## Context\n\nThe invoice."}</Markdown>);

    const heading = await screen.findByRole("heading", { name: "Context" });
    const style = getComputedStyle(heading);
    expect([style.fontSize, style.lineHeight, style.fontWeight]).toEqual([
      resolve("var(--text-ui)", "font-size"),
      resolve("var(--leading-ui)", "line-height"),
      "600",
    ]);
  });

  it("keeps the headings of a card body at the size of the UI, under the reading size of its text", async () => {
    setTheme(theme);
    renderWithStore(
      <Markdown className="card-body ui-headings">{"# Context\n\nThe invoice."}</Markdown>,
    );

    const heading = await screen.findByRole("heading", { name: "Context" });
    expect(getComputedStyle(heading).fontSize).toBe(resolve("var(--text-ui)", "font-size"));
  });

  it("puts Copy of a block at the end of its own header, in the header's height", async () => {
    setTheme(theme);
    const { container } = renderWithStore(
      <div style={{ width: 640 }}>
        <Markdown cutCode>{`\`\`\`go\n${LONG}\n\`\`\``}</Markdown>
      </div>,
    );

    const frame = container.querySelector("[data-code-block]");
    const copyButton = await screen.findByRole("button", { name: "Copy the code" });
    const header = copyButton.closest("[data-code-block] > div");
    if (frame === null || header === null) {
      throw new Error("the block has no header");
    }
    const own = container.querySelector('[data-streamdown="code-block-header"]');
    expect(own === null || getComputedStyle(own).display === "none").toBe(true);
    const copy = copyButton.getBoundingClientRect();
    const band = header.getBoundingClientRect();
    const box = frame.getBoundingClientRect();

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
    const frame = container.querySelector<HTMLElement>("[data-code-block]");
    const code = container.querySelector('[data-streamdown="code-block"]');
    if (frame === null || code === null) {
      throw new Error("the cut block is not drawn");
    }
    expect(paintOf(frame, { background: "" })).toEqual({ background: token("--surface-0") });
    const box = frame.getBoundingClientRect();
    const inner = code.getBoundingClientRect();
    const header = frame.firstElementChild?.getBoundingClientRect();
    expect([inner.top, inner.left, inner.right]).toEqual([header?.bottom, box.left, box.right]);
    const foot = show.parentElement;
    if (foot === null) {
      throw new Error("the foot is not drawn");
    }
    const row = foot.getBoundingClientRect();
    expect(row.top).toBeGreaterThanOrEqual(inner.bottom);
    expect(row.bottom).toBe(box.bottom);
    expect([row.left, row.right]).toEqual([box.left, box.right]);
  });

  it("draws a block that stays in a list item in the sunken frame of the system", async () => {
    setTheme(theme);
    const { container } = renderWithStore(
      <Markdown>{"1. Run:\n   ```bash\n   ls -la\n   ```\n2. Then"}</Markdown>,
    );

    await screen.findByText("Then");
    const block = container.querySelector('[data-streamdown="code-block"]');
    if (block === null) {
      throw new Error("the block is not drawn");
    }
    expect(container.querySelector("[data-code-block]")).toBeNull();
    expect(paintOf(block, { background: "" })).toEqual({ background: token("--surface-0") });
    expect(getComputedStyle(block).borderRadius).toBe(resolve("var(--radius-md)", "border-radius"));
    const header = container.querySelector('[data-streamdown="code-block-header"]');
    expect(header === null || getComputedStyle(header).display === "none").toBe(true);
  });
});
