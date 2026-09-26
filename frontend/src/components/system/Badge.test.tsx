import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Badge } from "./Badge";
import { ICONS } from "./icons";

describe("Badge", () => {
  it("renders its text", () => {
    renderWithStore(<Badge>Draft</Badge>);
    expect(screen.getByText("Draft")).toHaveClass("border-line-2");
  });

  it("marks the edited variant", () => {
    renderWithStore(<Badge variant="edited">Edited</Badge>);
    expect(screen.getByText("Edited")).toHaveClass("border-line-3", "text-ink-1");
  });

  it("tints the suggested variant", () => {
    renderWithStore(<Badge variant="suggested">Suggested</Badge>);
    expect(screen.getByText("Suggested")).toHaveClass("bg-brand-tint");
  });

  it("shows its icon at the extra small size", () => {
    renderWithStore(<Badge icon={ICONS.revised}>Revised</Badge>);
    expect(screen.getByText("Revised").querySelector("svg")).toHaveClass("size-(--icon-xs)");
  });
});
