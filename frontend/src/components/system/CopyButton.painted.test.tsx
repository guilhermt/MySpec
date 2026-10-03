import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { CopyButton } from "./CopyButton";

function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

describe.each(THEMES)("CopyButton in the %s theme", (theme) => {
  it("is a ghost --size-control-xs square in the icon variant", () => {
    setTheme(theme);
    render(<CopyButton variant="icon" label="Copy the error" text="x" />);
    const style = getComputedStyle(screen.getByRole("button"));
    expect(style.height).toBe(resolve("var(--size-control-xs)", "height"));
    expect(style.width).toBe(resolve("var(--size-control-xs)", "width"));
    expect(style.backgroundColor).toBe(resolve("transparent", "background-color"));
  });

  it("is a secondary --size-control-sm button in the page variant", () => {
    setTheme(theme);
    render(<CopyButton variant="page" label="Copy the list" text="x" />);
    const style = getComputedStyle(screen.getByRole("button"));
    expect(style.height).toBe(resolve("var(--size-control-sm)", "height"));
    expect(style.backgroundColor).toBe(token("--surface-2"));
  });

  it("says Copied in the third ink", async () => {
    setTheme(theme);
    stubClipboard(() => Promise.resolve());
    render(<CopyButton variant="page" label="Copy the list" text="x" />);
    await userEvent.click(screen.getByRole("button"));
    const note = (await screen.findAllByText("Copied")).find((el) => !el.matches(".sr-only"));
    expect(getComputedStyle(note as Element).color).toBe(token("--ink-3"));
  });

  it("says it can't copy in the error color", async () => {
    setTheme(theme);
    stubClipboard(() => Promise.reject(new Error("denied")));
    render(<CopyButton variant="page" label="Copy the list" text="x" />);
    await userEvent.click(screen.getByRole("button"));
    expect(getComputedStyle(await screen.findByRole("alert")).color).toBe(token("--state-error"));
  });

  it.each([
    ["icon", "after"],
    ["icon", "before"],
    ["page", "after"],
  ] as const)(
    "keeps the %s button in its place and its width, copied with the note %s it",
    async (variant, note) => {
      setTheme(theme);
      stubClipboard(() => Promise.resolve());
      render(
        <div
          style={{
            display: "flex",
            justifyContent: note === "after" ? "start" : "end",
            width: 400,
          }}
        >
          <CopyButton variant={variant} label="Copy the error" text="x" note={note} />
        </div>,
      );
      const button = screen.getByRole("button");
      const box = (button.parentElement as HTMLElement).getBoundingClientRect();
      const before = button.getBoundingClientRect();

      await userEvent.click(button);
      const copied = (await screen.findAllByText("Copied")).find((el) => !el.matches(".sr-only"));
      expect((button.parentElement as HTMLElement).getBoundingClientRect()).toEqual(box);
      expect(button.getBoundingClientRect()).toEqual(before);
      const text = (copied as Element).getBoundingClientRect();
      if (note === "after") {
        expect(text.left).toBeGreaterThanOrEqual(before.right);
      } else {
        expect(text.right).toBeLessThanOrEqual(before.left);
      }
    },
  );

  it("shows one check when copied, the button's", async () => {
    setTheme(theme);
    stubClipboard(() => Promise.resolve());
    const { container } = render(<CopyButton variant="icon" label="Copy the error" text="x" />);
    const glyphs = () => container.querySelectorAll("svg").length;
    const idle = glyphs();

    await userEvent.click(screen.getByRole("button"));
    await screen.findAllByText("Copied");
    expect(glyphs()).toBe(idle);
    expect(container.querySelector("[data-copy-note] svg")).toBeNull();
  });
});
