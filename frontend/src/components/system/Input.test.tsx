import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Field } from "./Field";
import { Input } from "./Input";

describe("Input", () => {
  it("is a textbox named by its field", () => {
    renderWithStore(
      <Field label="Branch">
        <Input />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Branch" })).toBeInTheDocument();
  });

  it("takes what is typed", async () => {
    const { user } = renderWithStore(<Input aria-label="Branch" />);
    await user.type(screen.getByRole("textbox", { name: "Branch" }), "main");
    expect(screen.getByRole("textbox", { name: "Branch" })).toHaveValue("main");
  });

  it("has the hover and the focus of the system", async () => {
    const { user } = renderWithStore(<Input aria-label="Branch" />);
    await user.tab();
    const input = screen.getByRole("textbox", { name: "Branch" });
    expect(input).toHaveFocus();
    expect(input).toHaveClass("hover:border-ink-3", "focus-visible:field-focus");
    expect(input).not.toHaveClass("focus-visible:ring-3", "md:text-sm");
  });

  it("is dashed while disabled", () => {
    renderWithStore(<Input aria-label="Branch" disabled />);
    const input = screen.getByRole("textbox", { name: "Branch" });
    expect(input).toBeDisabled();
    expect(input).toHaveClass("disabled:dashed-disabled");
    expect(input).not.toHaveClass("disabled:opacity-50");
  });

  it("is busy while loading", () => {
    renderWithStore(<Input aria-label="Branch" loading />);
    expect(screen.getByRole("textbox", { name: "Branch" })).toHaveAttribute("aria-busy", "true");
  });

  it("writes in the mono family", () => {
    renderWithStore(<Input aria-label="Branch" mono />);
    expect(screen.getByRole("textbox", { name: "Branch" })).toHaveClass("font-mono");
  });
});
