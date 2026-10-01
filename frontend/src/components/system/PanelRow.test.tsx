import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PanelRow } from "./PanelRow";

describe("PanelRow", () => {
  it("is plain text with its glyph and meta when it opens nothing", () => {
    render(
      <PanelRow glyph={<span>✓</span>} meta="a1b2c3d">
        Add the login form
      </PanelRow>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Add the login form")).toBeInTheDocument();
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("a1b2c3d")).toBeInTheDocument();
  });

  it("is a button that opens what it names", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <PanelRow meta="14:52" onClick={onClick}>
        PRD
      </PanelRow>,
    );

    await user.click(screen.getByRole("button", { name: /^PRD/ }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("takes its accessible name from label when given", () => {
    render(
      <PanelRow meta="2h" label="PRD conversation, 2 hours ago" onClick={() => {}}>
        PRD
      </PanelRow>,
    );

    expect(
      screen.getByRole("button", { name: "PRD conversation, 2 hours ago" }),
    ).toBeInTheDocument();
  });

  it("stands for what is open when pressed, and is not pressable without it", () => {
    render(
      <>
        <PanelRow pressed onClick={() => {}}>
          PRD
        </PanelRow>
        <PanelRow onClick={() => {}}>Tech spec</PanelRow>
      </>,
    );

    expect(screen.getByRole("button", { name: "PRD" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tech spec" })).not.toHaveAttribute("aria-pressed");
  });

  it("says its opening is on its way when busy", () => {
    render(
      <PanelRow busy onClick={() => {}}>
        PRD
      </PanelRow>,
    );

    expect(screen.getByRole("button", { name: "PRD" })).toHaveAttribute("aria-busy", "true");
  });

  it("takes the focus when it appears, if asked, with its id for the focus to come back", () => {
    render(
      <PanelRow id="row-prd" focusOnMount onClick={() => {}}>
        PRD
      </PanelRow>,
    );

    const row = screen.getByRole("button", { name: "PRD" });
    expect(row).toHaveFocus();
    expect(row).toHaveAttribute("id", "row-prd");
  });

  it("leaves the focus alone otherwise", () => {
    render(<PanelRow onClick={() => {}}>PRD</PanelRow>);

    expect(screen.getByRole("button", { name: "PRD" })).not.toHaveFocus();
  });
});
