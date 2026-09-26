import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { type Paint, paintOf, resolve, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { Field } from "./Field";
import { Input } from "./Input";
import { Textarea } from "./Textarea";

const FIELDS = [
  { name: "Input", Control: Input },
  { name: "Textarea", Control: Textarea },
] as const;

/** field is the paint of a field state: its body, its line and its shadow. */
function field(background: string, border: string, shadow = "none", borderStyle = "solid"): Paint {
  return { background, border, borderStyle, shadow };
}

/** expectPaint compares what the named textbox paints with the paint it should have. */
function expectPaint(want: Paint) {
  expect(paintOf(screen.getByRole("textbox", { name: "Name" }), want)).toEqual(want);
}

const halo = () => resolve("0 0 0 var(--halo) var(--focus-halo)", "box-shadow");
const rail = () => resolve("inset var(--error-rail) 0 0 var(--state-error)", "box-shadow");
const railAndHalo = () =>
  resolve(
    "inset var(--error-rail) 0 0 var(--state-error), 0 0 0 var(--halo) var(--focus-halo)",
    "box-shadow",
  );

describe.each(THEMES)("text fields in the %s theme", (theme) => {
  describe.each(FIELDS)("$name", ({ Control }) => {
    it("rests on the input surface with the control line", () => {
      setTheme(theme);
      render(
        <Field label="Name">
          <Control />
        </Field>,
      );
      expectPaint(field(token("--surface-input"), token("--line-3")));
    });

    it("shows focus on its border, with the halo", async () => {
      setTheme(theme);
      render(
        <Field label="Name">
          <Control />
        </Field>,
      );
      await userEvent.click(screen.getByRole("textbox", { name: "Name" }));
      expectPaint(field(token("--surface-input"), token("--focus"), halo()));
    });

    it("shows an error with the full error border and the inner rail", () => {
      setTheme(theme);
      render(
        <Field label="Name" error="Spaces aren't allowed">
          <Control />
        </Field>,
      );
      expectPaint(field(token("--surface-input"), token("--state-error"), rail()));
    });

    it("keeps the error border and the rail while focused, and adds the halo outside", async () => {
      setTheme(theme);
      render(
        <Field label="Name" error="Spaces aren't allowed">
          <Control />
        </Field>,
      );
      await userEvent.click(screen.getByRole("textbox", { name: "Name" }));
      expectPaint(field(token("--surface-input"), token("--state-error"), railAndHalo()));
    });

    it("is dashed, without a body and in faint ink when disabled", () => {
      setTheme(theme);
      render(
        <Field label="Name">
          <Control disabled />
        </Field>,
      );
      expectPaint({
        ...field(TRANSPARENT, token("--line-3"), "none", "dashed"),
        color: token("--ink-4"),
      });
    });

    it("keeps the dashed line and shows the focus when disabled and focused", async () => {
      setTheme(theme);
      render(
        <Field label="Name">
          <Control disabled disabledReason="The task already exists" />
        </Field>,
      );
      await userEvent.tab();
      expectPaint({
        ...field(TRANSPARENT, token("--focus"), halo(), "dashed"),
        color: token("--ink-4"),
      });
    });
  });
});
