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

  it("stays focusable and read-only while disabled, with the reason after the help", async () => {
    const { user } = renderWithStore(
      <Field label="Description" help="Where the work starts">
        <Textarea disabled disabledReason="The task already exists" defaultValue="main" />
      </Field>,
    );
    const field = screen.getByRole("textbox", { name: "Description" });
    expect(field).toHaveAttribute("aria-disabled", "true");
    expect(field).toHaveAccessibleDescription("Where the work starts The task already exists");
    await user.tab();
    expect(field).toHaveFocus();
    await user.type(field, "x");
    expect(field).toHaveValue("main");
  });

  it("carries its reason next to it outside a field", () => {
    renderWithStore(
      <Textarea aria-label="Description" disabled disabledReason="The task already exists" />,
    );
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveAccessibleDescription(
      "The task already exists",
    );
  });

  it("is busy while loading, with the spinner and the gerund on the help line", () => {
    renderWithStore(
      <Field label="Description" help="Where the work starts">
        <Textarea loading loadingLabel="Checking the name…" />
      </Field>,
    );
    const field = screen.getByRole("textbox", { name: "Description" });
    expect(field).toHaveAttribute("aria-busy", "true");
    expect(field).toHaveAccessibleDescription("Checking the name… Where the work starts");
  });

  it("carries its gerund next to it outside a field", () => {
    renderWithStore(
      <Textarea aria-label="Description" loading loadingLabel="Checking the name…" />,
    );
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveAccessibleDescription(
      "Checking the name…",
    );
  });

  it("writes in the mono family", () => {
    renderWithStore(<Textarea aria-label="Description" mono />);
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveClass("font-mono");
  });
});
