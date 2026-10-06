import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveRegion } from "./LiveRegion";
import { useArrivedLater } from "./useArrivedLater";

describe("LiveRegion", () => {
  it("is a span unless it is asked to be a div", () => {
    const { rerender } = render(<LiveRegion kind="status" />);
    expect(screen.getByRole("status").tagName).toBe("SPAN");
    rerender(<LiveRegion kind="status" as="div" />);
    expect(screen.getByRole("status").tagName).toBe("DIV");
  });

  it("stays on screen without a text and holds it when there is one", () => {
    const { rerender } = render(<LiveRegion kind="status" />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();

    rerender(<LiveRegion kind="status">Cloning…</LiveRegion>);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Cloning…");
  });

  it("is an alert when it says so", () => {
    render(<LiveRegion kind="alert" className="text-state-error" />);
    expect(screen.getByRole("alert")).toHaveClass("text-state-error");
  });
});

function Probe({ present }: { present: boolean }) {
  return <p>{useArrivedLater(present) ? "arrived" : "not arrived"}</p>;
}

describe("useArrivedLater", () => {
  it("is false for what was there when the screen opened, even while it stays", () => {
    const { rerender } = render(<Probe present />);
    expect(screen.getByText("not arrived")).toBeInTheDocument();
    rerender(<Probe present />);
    expect(screen.getByText("not arrived")).toBeInTheDocument();
  });

  it("is true for what became present afterwards, and false again once it goes", () => {
    const { rerender } = render(<Probe present={false} />);
    expect(screen.getByText("not arrived")).toBeInTheDocument();
    rerender(<Probe present />);
    expect(screen.getByText("arrived")).toBeInTheDocument();
    rerender(<Probe present={false} />);
    expect(screen.getByText("not arrived")).toBeInTheDocument();
  });

  it("is true for what goes away and comes back", () => {
    const { rerender } = render(<Probe present />);
    rerender(<Probe present={false} />);
    rerender(<Probe present />);
    expect(screen.getByText("arrived")).toBeInTheDocument();
  });
});
