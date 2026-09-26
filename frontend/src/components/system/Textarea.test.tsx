import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Field } from "./Field";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("is a textbox named by its field", () => {
    renderWithStore(
      <Field label="Description">
        <Textarea />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Description" })).toBeInTheDocument();
  });

  it("takes what is typed", async () => {
    const { user } = renderWithStore(<Textarea aria-label="Description" />);
    await user.type(screen.getByRole("textbox", { name: "Description" }), "main");
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("main");
  });

  it("takes the focus", async () => {
    const { user } = renderWithStore(<Textarea aria-label="Description" />);
    await user.tab();
    const input = screen.getByRole("textbox", { name: "Description" });
    expect(input).toHaveFocus();
  });

  it("is disabled", () => {
    renderWithStore(<Textarea aria-label="Description" disabled />);
    const input = screen.getByRole("textbox", { name: "Description" });
    expect(input).toBeDisabled();
  });

  it("is busy while loading", () => {
    renderWithStore(<Textarea aria-label="Description" loading />);
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("writes in the mono family", () => {
    renderWithStore(<Textarea aria-label="Description" mono />);
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveClass("font-mono");
  });
});
