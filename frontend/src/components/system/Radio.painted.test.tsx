import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, paintOf, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { Radio, RadioGroup, type RadioGroupProps, RadioInput } from "./Radio";

function Subject(props: Partial<RadioGroupProps>) {
  return (
    <RadioGroup label="Merge method" value="merge" onValueChange={() => {}} {...props}>
      <Radio value="merge">Merge commit</Radio>
      <Radio value="squash">Squash</Radio>
    </RadioGroup>
  );
}

/** ring is the drawn ring at the start of a radio row. */
function ring(name: string): Element {
  const found = screen.getByRole("radio", { name }).querySelector("span");
  if (found === null) throw new Error(`the radio ${name} draws no ring`);
  return found;
}

describe.each(THEMES)("Radio in the %s theme", (theme) => {
  it("draws the ring on the input surface, in the brand when chosen", () => {
    setTheme(theme);
    render(<Subject />);
    const rest = { background: token("--surface-input"), border: token("--line-3") };
    expect(paintOf(ring("Squash"), rest)).toEqual(rest);
    expect(paintOf(ring("Merge commit"), { border: "" })).toEqual({ border: token("--brand") });
  });

  it("darkens the ring of an unchosen radio on hover", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.hover(screen.getByRole("radio", { name: "Squash" }));
    expect(paintOf(ring("Squash"), { border: "" })).toEqual({ border: token("--ink-3") });
  });

  it("rings the row on focus", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(screen.getByRole("radio", { name: "Merge commit" }), want)).toEqual(want);
  });

  it("paints the error ring on the error veil", () => {
    setTheme(theme);
    render(<Subject invalid />);
    const want = { background: token("--state-error-veil"), border: token("--state-error") };
    expect(paintOf(ring("Squash"), want)).toEqual(want);
  });

  it("dashes the rings without a body and writes the rows faint when disabled", async () => {
    setTheme(theme);
    render(<Subject disabled disabledReason="The repository allows only squash" />);
    await userEvent.hover(screen.getByRole("radio", { name: "Squash" }));
    const want = { background: TRANSPARENT, border: token("--line-3"), borderStyle: "dashed" };
    expect(paintOf(ring("Squash"), want)).toEqual(want);
    expect(paintOf(screen.getByRole("radio", { name: "Squash" }), { color: "" })).toEqual({
      color: token("--ink-4"),
    });
  });
});

function Inputs() {
  return (
    <>
      <RadioInput name="fresh" value="todo" checked onChoose={() => {}} label="Todo" />
      <RadioInput name="fresh" value="done" checked={false} onChoose={() => {}} label="Done" />
    </>
  );
}

/** dot is the point a chosen RadioInput draws in its ring. */
function dot(name: string): Element {
  const found = screen.getByRole("radio", { name }).nextElementSibling;
  if (found === null) throw new Error(`the radio ${name} draws no dot`);
  return found;
}

describe.each(THEMES)("RadioInput in the %s theme", (theme) => {
  it("draws the ring like a Radio, in the brand with its dot when chosen", () => {
    setTheme(theme);
    render(<Inputs />);
    const rest = { background: token("--surface-input"), border: token("--line-3") };
    expect(paintOf(screen.getByRole("radio", { name: "Done" }), rest)).toEqual(rest);
    expect(paintOf(screen.getByRole("radio", { name: "Todo" }), { border: "" })).toEqual({
      border: token("--brand"),
    });
    expect(dot("Todo").getBoundingClientRect().width).toBeGreaterThan(0);
    expect(dot("Done").getBoundingClientRect().width).toBe(0);
    expect(paintOf(dot("Todo"), { background: "" })).toEqual({ background: token("--brand") });
  });

  it("darkens the ring of an unchosen radio when its cell is hovered", async () => {
    setTheme(theme);
    render(<Inputs />);
    await userEvent.hover(screen.getByRole("radio", { name: "Done" }).closest("label") as Element);
    expect(paintOf(screen.getByRole("radio", { name: "Done" }), { border: "" })).toEqual({
      border: token("--ink-3"),
    });
  });

  it("rings the cell on focus", async () => {
    setTheme(theme);
    render(<Inputs />);
    await userEvent.tab();
    const want = focusRing();
    const cell = screen.getByRole("radio", { name: "Todo" }).closest("label") as Element;
    expect(paintOf(cell, want)).toEqual(want);
  });
});
