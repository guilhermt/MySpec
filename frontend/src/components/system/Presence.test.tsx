import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Presence } from "./Presence";

describe("Presence", () => {
  it("shows what it holds", () => {
    render(<Presence>{<p>The panel</p>}</Presence>);

    expect(screen.getByText("The panel")).toBeInTheDocument();
  });

  it("lets it go at once when no exit plays", () => {
    const { rerender } = render(<Presence>{<p>The panel</p>}</Presence>);

    rerender(<Presence>{null}</Presence>);

    expect(screen.queryByText("The panel")).not.toBeInTheDocument();
  });

  it("shows it again when it comes back", () => {
    const { rerender } = render(<Presence>{<p>The panel</p>}</Presence>);

    rerender(<Presence>{false}</Presence>);
    rerender(<Presence>{<p>The panel</p>}</Presence>);

    expect(screen.getByText("The panel")).toBeInTheDocument();
  });
});
