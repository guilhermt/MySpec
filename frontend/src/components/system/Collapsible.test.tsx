import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./Collapsible";

function Subject() {
  return (
    <Collapsible>
      <CollapsibleTrigger>Details</CollapsibleTrigger>
      <CollapsibleContent>The full log</CollapsibleContent>
    </Collapsible>
  );
}

describe("Collapsible", () => {
  it("is a button that tells whether it is expanded", () => {
    renderWithStore(<Subject />);
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("shows and hides its content on click", async () => {
    const { user } = renderWithStore(<Subject />);
    const trigger = screen.getByRole("button", { name: "Details" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("The full log")).toBeVisible();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("The full log")).not.toBeInTheDocument();
  });

  it("has the hover and the focus of the system", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    const trigger = screen.getByRole("button", { name: "Details" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveClass("hover:text-ink-1", "focus-visible:focus-ring");
  });
});
