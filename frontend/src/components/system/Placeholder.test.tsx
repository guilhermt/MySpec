import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Placeholder } from "./Placeholder";

describe("Placeholder", () => {
  it("renders its variable in mono with a border", () => {
    renderWithStore(<Placeholder>{"{{prd_path}}"}</Placeholder>);
    expect(screen.getByText("{{prd_path}}")).toHaveClass("font-mono", "border-line-2");
  });
});
