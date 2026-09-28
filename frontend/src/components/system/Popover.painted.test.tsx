import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { Popover } from "./Popover";

function Subject() {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={anchor}>
        More
      </button>
      <Popover open onOpenChange={() => {}} anchor={anchor} title="Models">
        <p>A stage takes its model when it starts.</p>
      </Popover>
    </>
  );
}

describe.each(THEMES)("Popover in the %s theme", (theme) => {
  it("is a sheet of --size-popover on the top surface with the float shadow", async () => {
    setTheme(theme);
    render(<Subject />);
    const sheet = await screen.findByRole("dialog", { name: "Models" });
    const want = {
      background: token("--surface-3"),
      color: token("--ink-1"),
      shadow: resolve("var(--shadow-float)", "box-shadow"),
    };
    expect(paintOf(sheet, want)).toEqual(want);
    expect(getComputedStyle(sheet).borderTopLeftRadius).toBe(
      resolve("var(--radius-lg)", "border-top-left-radius"),
    );
    expect(`${sheet.offsetWidth}px`).toBe(resolve("var(--size-popover)", "width"));
  });

  it("opens under its anchor, aligned to its end", async () => {
    setTheme(theme);
    render(<Subject />);
    const sheet = await screen.findByRole("dialog", { name: "Models" });
    const anchor = screen.getByRole("button", { name: "More" }).getBoundingClientRect();
    await expect
      .poll(() => sheet.getBoundingClientRect().top)
      .toBeGreaterThanOrEqual(anchor.bottom);
  });

  it("titles the sheet in the first ink, semibold", async () => {
    setTheme(theme);
    render(<Subject />);
    const title = await screen.findByText("Models");
    expect(paintOf(title, { color: "" })).toEqual({ color: token("--ink-1") });
    expect(getComputedStyle(title).fontWeight).toBe("600");
  });
});
