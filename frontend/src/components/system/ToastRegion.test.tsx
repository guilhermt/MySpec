import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { ToastRegion } from "./ToastRegion";

describe("ToastRegion", () => {
  it("is a polite live region", () => {
    renderWithStore(<ToastRegion announcement={null} />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("says the announcement in the same container as the toasts", () => {
    renderWithStore(
      <ToastRegion announcement={{ id: 1, text: "Nothing else needs you now." }}>
        <p>A toast</p>
      </ToastRegion>,
    );

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("A toast");
    expect(region).toHaveTextContent("Nothing else needs you now.");
  });

  it("hides the announcement from the eye", () => {
    renderWithStore(<ToastRegion announcement={{ id: 1, text: "Nothing else needs you now." }} />);

    expect(screen.getByText("Nothing else needs you now.")).toHaveClass("sr-only");
  });

  it("says the same text again with a new id", () => {
    const { rerender } = renderWithStore(
      <ToastRegion announcement={{ id: 1, text: "Nothing else needs you now." }} />,
    );
    const first = screen.getByText("Nothing else needs you now.");

    rerender(<ToastRegion announcement={{ id: 2, text: "Nothing else needs you now." }} />);

    expect(screen.getByText("Nothing else needs you now.")).not.toBe(first);
  });
});
