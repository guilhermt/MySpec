import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Pill, type PillView } from "./Pill";

const WORKING: PillView = {
  name: "Implementation",
  position: "3/7",
  qualifier: "round 1",
  keepsQualifier: false,
  glyph: "work",
  word: "working",
  shimmer: false,
  paused: false,
  state: "Implementer working",
};

describe("Pill", () => {
  it("says the stage, the position with the qualifier, and the word", () => {
    const { container } = renderWithStore(<Pill pill={WORKING} />);
    expect(container).toHaveTextContent("Implementation3/7 · round 1working");
  });

  it("is not a button", () => {
    renderWithStore(<Pill pill={WORKING} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("draws the divider and the glyph only with a glyph", () => {
    const { container, rerender } = renderWithStore(<Pill pill={WORKING} />);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(1);
    rerender(<Pill pill={{ ...WORKING, glyph: null, word: "" }} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("lets the qualifier and the word give way below 1040px", () => {
    renderWithStore(<Pill pill={WORKING} />);
    expect(screen.getByText(/round 1/)).toHaveClass("@max-[1040px]/main:sr-only");
    expect(screen.getByText("working")).toHaveClass("@max-[1040px]/main:sr-only");
  });

  it("keeps a qualifier that stands for the position", () => {
    renderWithStore(
      <Pill pill={{ ...WORKING, position: "", qualifier: "pass 2", keepsQualifier: true }} />,
    );
    const qualifier = screen.getByText("pass 2");
    expect(qualifier).toHaveTextContent(/^pass 2$/);
    expect(qualifier).not.toHaveClass("@max-[1040px]/main:sr-only");
  });

  it("glows over the word with shimmer", () => {
    renderWithStore(
      <Pill pill={{ ...WORKING, glyph: "github", word: "checking GitHub", shimmer: true }} />,
    );
    expect(screen.getByText("checking GitHub")).toHaveClass("shimmer-text");
  });

  it("marks the neutral pill when paused", () => {
    const { container } = renderWithStore(
      <Pill pill={{ ...WORKING, glyph: "paused", word: "paused", paused: true }} />,
    );
    expect(container.firstElementChild).toHaveAttribute("data-paused", "true");
  });
});
