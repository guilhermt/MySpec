import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { Kbd } from "./Kbd";

describe.each(THEMES)("Kbd in the %s theme", (theme) => {
  it("is a mono key on the raised surface, with the heavier bottom line", () => {
    setTheme(theme);
    render(<Kbd>K</Kbd>);
    const key = screen.getByText("K");
    const want = {
      background: token("--surface-2"),
      color: token("--ink-3"),
      border: token("--line-2"),
      height: "18px",
    };
    expect(paintOf(key, want)).toEqual(want);
    expect(getComputedStyle(key).borderBottomWidth).toBe("2px");
    expect(getComputedStyle(key).fontFamily).toBe(resolve("var(--font-mono)", "font-family"));
  });

  it("stands ↵, which no font of the app draws, on a whole pixel", () => {
    setTheme(theme);
    render(<Kbd>Ctrl ↵</Kbd>);
    const width = screen.getByText("↵").closest("kbd")?.getBoundingClientRect().width ?? 0;
    expect(Number.isInteger(width)).toBe(true);
  });

  it("measures the small size", () => {
    setTheme(theme);
    render(<Kbd size="sm">K</Kbd>);
    expect(paintOf(screen.getByText("K"), { height: "" })).toEqual({ height: "16px" });
  });

  it("sits on the primary button with the key ring", () => {
    setTheme(theme);
    render(<Kbd variant="on-primary">Enter</Kbd>);
    const want = {
      background: TRANSPARENT,
      color: token("--brand-on"),
      shadow: resolve("inset 0 0 0 var(--border) var(--brand-key-ring)", "box-shadow"),
    };
    expect(paintOf(screen.getByText("Enter"), want)).toEqual(want);
  });

  it("marks the jump key in the tint", () => {
    setTheme(theme);
    render(<Kbd variant="jump">Ctrl J</Kbd>);
    const want = {
      background: token("--brand-tint"),
      color: token("--brand-ink"),
      border: token("--brand-ring"),
    };
    expect(paintOf(screen.getByText("Ctrl J"), want)).toEqual(want);
  });
});
