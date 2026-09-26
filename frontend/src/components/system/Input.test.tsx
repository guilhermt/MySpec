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

  it("takes the focus", async () => {
    const { user } = renderWithStore(<Input aria-label="Branch" />);
    await user.tab();
    const input = screen.getByRole("textbox", { name: "Branch" });
    expect(input).toHaveFocus();
  });

  it("stays focusable and read-only while disabled, with the reason after the help", async () => {
    const { user } = renderWithStore(
      <Field label="Branch" help="Where the work starts">
        <Input disabled disabledReason="The task already exists" defaultValue="main" />
      </Field>,
    );
    const field = screen.getByRole("textbox", { name: "Branch" });
    expect(field).toHaveAttribute("aria-disabled", "true");
    expect(field).toHaveAccessibleDescription("Where the work starts The task already exists");
    await user.tab();
    expect(field).toHaveFocus();
    await user.type(field, "x");
    expect(field).toHaveValue("main");
  });

  it("carries its reason next to it outside a field", () => {
    renderWithStore(
      <Input aria-label="Branch" disabled disabledReason="The task already exists" />,
    );
    expect(screen.getByRole("textbox", { name: "Branch" })).toHaveAccessibleDescription(
      "The task already exists",
    );
  });

  it("is busy while loading, with the spinner and the gerund on the help line", () => {
    renderWithStore(
      <Field label="Branch" help="Where the work starts">
        <Input loading loadingLabel="Checking the name…" />
      </Field>,
    );
    const field = screen.getByRole("textbox", { name: "Branch" });
    expect(field).toHaveAttribute("aria-busy", "true");
    expect(field).toHaveAccessibleDescription("Checking the name… Where the work starts");
  });

  it("carries its gerund next to it outside a field", () => {
    renderWithStore(<Input aria-label="Branch" loading loadingLabel="Checking the name…" />);
    expect(screen.getByRole("textbox", { name: "Branch" })).toHaveAccessibleDescription(
      "Checking the name…",
    );
  });

  it("writes in the mono family", () => {
    renderWithStore(<Input aria-label="Branch" mono />);
    expect(screen.getByRole("textbox", { name: "Branch" })).toHaveClass("font-mono");
  });
});
