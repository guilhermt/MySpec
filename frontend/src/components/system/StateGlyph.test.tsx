import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { type GlyphState, StateGlyph } from "./StateGlyph";

const STATES: GlyphState[] = [
  "error",
  "wait",
  "close",
  "work",
  "github",
  "paused",
  "idle",
  "blocked",
  "todo",
];

describe("StateGlyph", () => {
  it.each(STATES)("names the %s glyph by its label", (state) => {
    renderWithStore(<StateGlyph state={state} label={`state ${state}`} />);
    expect(screen.getByRole("img", { name: `state ${state}` })).toHaveAttribute(
      "data-state",
      state,
    );
  });

  it("is hidden without a label", () => {
    const { container } = renderWithStore(<StateGlyph state="idle" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("spins in the work state", () => {
    renderWithStore(<StateGlyph state="work" label="working" />);
    expect(screen.getByRole("img", { name: "working" }).firstElementChild).toHaveClass(
      "spin-glyph",
    );
  });

  it.each(STATES.filter((s) => s !== "work"))("does not spin in the %s state", (state) => {
    const { container } = renderWithStore(<StateGlyph state={state} />);
    expect(container.querySelector(".spin-glyph")).toBeNull();
  });

  it("draws the error diamond at the diamond size", () => {
    renderWithStore(<StateGlyph state="error" label="failed" />);
    expect(screen.getByRole("img", { name: "failed" })).toHaveClass(
      "size-(--glyph-diamond)",
      "rotate-45",
      "bg-state-error",
    );
  });

  it("uses the small size", () => {
    renderWithStore(<StateGlyph state="todo" size="sm" label="to do" />);
    expect(screen.getByRole("img", { name: "to do" })).toHaveClass("size-(--glyph-sm)");
  });

  it("uses the small size in the work state", () => {
    renderWithStore(<StateGlyph state="work" size="sm" label="working" />);
    expect(screen.getByRole("img", { name: "working" }).firstElementChild).toHaveClass(
      "size-(--glyph-sm)",
    );
  });
});
