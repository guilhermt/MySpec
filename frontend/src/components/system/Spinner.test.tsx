import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("is hidden from assistive technology", () => {
    const { container } = renderWithStore(<Spinner />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("spins with the system loop", () => {
    const { container } = renderWithStore(<Spinner />);
    expect(container.firstElementChild).toHaveClass("spin-glyph");
  });

  it.each([
    ["work", "var(--state-work)"],
    ["current", "currentColor"],
    ["on-solid", "currentColor"],
  ] as const)("puts the arc of the %s tone in --spin-arc", (tone, arc) => {
    const { container } = renderWithStore(<Spinner tone={tone} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.getPropertyValue("--spin-arc")).toBe(arc);
  });
});
