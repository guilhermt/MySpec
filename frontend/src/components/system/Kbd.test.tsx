import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Kbd } from "./Kbd";

describe("Kbd", () => {
  it("renders its key as a kbd element", () => {
    renderWithStore(<Kbd>K</Kbd>);
    expect(screen.getByText("K").tagName).toBe("KBD");
  });

  it("keeps the whole text of a key with ↵", () => {
    renderWithStore(<Kbd>Ctrl ↵</Kbd>);
    expect(screen.getByText("↵").closest("kbd")).toHaveTextContent("Ctrl ↵");
  });
});
