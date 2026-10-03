import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, paintOf, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { Checkbox, type CheckboxProps } from "./Checkbox";

function Subject(props: Partial<CheckboxProps>) {
  return (
    <Checkbox checked={false} onCheckedChange={() => {}} {...props}>
      Include tests
    </Checkbox>
  );
}

/** box is the drawn box at the start of the row. */
function box(): Element {
  const found = screen.getByRole("checkbox", { name: "Include tests" }).querySelector("span");
  if (found === null) throw new Error("the checkbox row draws no box");
  return found;
}

describe.each(THEMES)("Checkbox in the %s theme", (theme) => {
  it("draws the box on the input surface with the control line", () => {
    setTheme(theme);
    render(<Subject />);
    const want = { background: token("--surface-input"), border: token("--line-3") };
    expect(paintOf(box(), want)).toEqual(want);
  });

  it("darkens the line of the box on hover", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.hover(screen.getByRole("checkbox", { name: "Include tests" }));
    expect(paintOf(box(), { border: "" })).toEqual({ border: token("--ink-3") });
  });

  it("fills the checked box with the brand", () => {
    setTheme(theme);
    render(<Subject checked />);
    const want = { background: token("--brand"), border: token("--brand") };
    expect(paintOf(box(), want)).toEqual(want);
  });

  it("rings the whole row on focus", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(screen.getByRole("checkbox", { name: "Include tests" }), want)).toEqual(want);
  });

  it("dashes the box without a body and writes the row faint when disabled", async () => {
    setTheme(theme);
    render(<Subject disabled disabledReason="Tests are required" />);
    await userEvent.hover(screen.getByRole("checkbox", { name: "Include tests" }));
    const want = { background: TRANSPARENT, border: token("--line-3"), borderStyle: "dashed" };
    expect(paintOf(box(), want)).toEqual(want);
    expect(paintOf(screen.getByRole("checkbox", { name: "Include tests" }), { color: "" })).toEqual(
      { color: token("--ink-4") },
    );
  });
});

describe("Checkbox while it loads", () => {
  it("keeps the text where the box left it", () => {
    const row = (loading: boolean) => (
      <Checkbox checked={false} onCheckedChange={() => {}} loading={loading}>
        <span>Include tests</span>
      </Checkbox>
    );
    const { rerender } = render(row(false));
    const left = () => screen.getByText("Include tests").getBoundingClientRect().left;
    const idle = left();
    rerender(row(true));
    expect(left()).toBe(idle);
  });
});
