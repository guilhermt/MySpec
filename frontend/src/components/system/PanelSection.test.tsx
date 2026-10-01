import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PanelSection } from "./PanelSection";

describe("PanelSection", () => {
  it("is a group named by its legend, with the legend as its heading", () => {
    render(
      <PanelSection legend="Steps · 2 of 7 committed">
        <p>Add the login form</p>
      </PanelSection>,
    );

    const section = screen.getByRole("region", { name: "Steps · 2 of 7 committed" });
    expect(
      within(section).getByRole("heading", { level: 3, name: "Steps · 2 of 7 committed" }),
    ).toBeInTheDocument();
    expect(within(section).getByText("Add the login form")).toBeInTheDocument();
  });

  it("puts its content after the legend", () => {
    render(
      <PanelSection legend="Task">
        <p>Branch</p>
      </PanelSection>,
    );

    const heading = screen.getByRole("heading", { name: "Task" });
    expect(
      heading.compareDocumentPosition(screen.getByText("Branch")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
