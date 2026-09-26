import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Kbd } from "./Kbd";

describe("Kbd", () => {
  it("renders its key as a kbd element", () => {
    renderWithStore(<Kbd>K</Kbd>);
    expect(screen.getByText("K").tagName).toBe("KBD");
  });
});
