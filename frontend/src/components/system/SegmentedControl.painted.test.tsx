import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, paintOf, resolve, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { SegmentedControl, type SegmentedControlProps } from "./SegmentedControl";

const OPTIONS = [
  { value: "chat", label: "Chat" },
  { value: "changes", label: "Changes" },
] as const;

function Subject(props: Partial<SegmentedControlProps<"chat" | "changes">>) {
  return (
    <SegmentedControl
      label="View"
      value="chat"
      options={OPTIONS}
      onValueChange={() => {}}
      {...props}
    />
  );
}

describe.each(THEMES)("SegmentedControl in the %s theme", (theme) => {
  it("sets the segments in the sunken track, the chosen one tinted with the ring", () => {
    setTheme(theme);
    render(<Subject />);
    expect(paintOf(screen.getByRole("radiogroup", { name: "View" }), { background: "" })).toEqual({
      background: token("--surface-0"),
    });
    const chosen = {
      background: token("--brand-tint"),
      color: token("--ink-1"),
      shadow: resolve("inset 0 0 0 var(--border) var(--brand-ring)", "box-shadow"),
    };
    expect(paintOf(screen.getByRole("radio", { name: "Chat" }), chosen)).toEqual(chosen);
    const other = { background: TRANSPARENT, color: token("--ink-2") };
    expect(paintOf(screen.getByRole("radio", { name: "Changes" }), other)).toEqual(other);
  });

  it("veils an unchosen segment on hover", async () => {
    setTheme(theme);
    render(<Subject />);
    const segment = screen.getByRole("radio", { name: "Changes" });
    await userEvent.hover(segment);
    const want = { background: token("--veil-hover"), color: token("--ink-1") };
    expect(paintOf(segment, want)).toEqual(want);
  });

  it("rings the chosen segment on focus", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(screen.getByRole("radio", { name: "Chat" }), want)).toEqual(want);
  });
});
