import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Shimmer } from "./Shimmer";

describe("Shimmer", () => {
  it("reads its text with the shimmer", () => {
    renderWithStore(<Shimmer>checking GitHub</Shimmer>);
    expect(screen.getByText("checking GitHub")).toHaveClass("shimmer-text");
  });
});
