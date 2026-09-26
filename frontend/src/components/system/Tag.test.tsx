import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Tag } from "./Tag";

describe("Tag", () => {
  it("renders its text in mono", () => {
    renderWithStore(<Tag>main</Tag>);
    expect(screen.getByText("main")).toHaveClass("font-mono");
  });
});
