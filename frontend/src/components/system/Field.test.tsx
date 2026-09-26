import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Field, useFieldControl } from "./Field";
import { Input } from "./Input";

describe("Field", () => {
  it("names its control with the label and the complement", () => {
    renderWithStore(
      <Field label="Title" complement="optional">
        <Input />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Title optional" })).toBeInTheDocument();
  });

  it("describes its control with the help", () => {
    renderWithStore(
      <Field label="Title" help="Shown on the board">
        <Input />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveAccessibleDescription(
      "Shown on the board",
    );
  });

  it("marks its control invalid and describes it with the error", () => {
    renderWithStore(
      <Field label="Title" help="Shown on the board" error="Title is required">
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Title" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Title is required");
    expect(screen.getByText("Title is required")).toHaveClass("text-state-error");
  });

  it("shows the counter from 20 below the limit", () => {
    const { rerender } = renderWithStore(
      <Field label="Title" count={{ length: 79, max: 100 }}>
        <Input />
      </Field>,
    );
    expect(screen.queryByText("79/100")).not.toBeInTheDocument();
    rerender(
      <Field label="Title" count={{ length: 80, max: 100 }}>
        <Input />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveAccessibleDescription("80/100");
  });

  it("gives no control outside a field", () => {
    function Probe() {
      return <span>{useFieldControl() === null ? "none" : "field"}</span>;
    }
    renderWithStore(<Probe />);
    expect(screen.getByText("none")).toBeInTheDocument();
  });
});
