import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { ContextMeter } from "./ContextMeter";

describe("ContextMeter", () => {
  it("is a meter named Context with the rounded percentage", () => {
    renderWithStore(<ContextMeter percent={42.4} detail="84k of 200k tokens" />);
    const meter = screen.getByRole("meter", { name: "Context" });
    expect(meter).toHaveAttribute("aria-valuenow", "42");
    expect(meter).toHaveTextContent("42%");
  });

  it("keeps its colour when nearly full", () => {
    const { container } = renderWithStore(<ContextMeter percent={95} detail="190k of 200k" />);
    for (const el of container.querySelectorAll("*")) {
      expect(el.className.toString()).not.toMatch(/(text|bg)-state-/);
    }
  });

  it("shimmers with an ellipsis before the first reading", () => {
    const { container } = renderWithStore(<ContextMeter percent={null} detail="Not read yet" />);
    const meter = screen.getByRole("meter", { name: "Context" });
    expect(meter).toHaveTextContent("…");
    expect(meter).toHaveAttribute("aria-valuetext", "not read yet");
    expect(container.querySelector(".shimmer-track")).toBeInTheDocument();
  });

  it("shows a dash while paused", () => {
    renderWithStore(<ContextMeter percent={30} paused detail="Paused" />);
    const meter = screen.getByRole("meter", { name: "Context" });
    expect(meter).toHaveTextContent("—");
    expect(meter).toHaveAttribute("aria-valuetext", "paused");
  });

  it("hides the track when compact", () => {
    const { container } = renderWithStore(<ContextMeter percent={30} compact detail="60k" />);
    expect(container.querySelector('[data-slot="track"]')).toBeNull();
    expect(screen.getByRole("meter", { name: "Context" })).toHaveTextContent("30%");
  });

  it("shows its detail in a tooltip on focus", async () => {
    const { user } = renderWithStore(<ContextMeter percent={30} detail="60k of 200k tokens" />);
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("60k of 200k tokens");
  });
});
