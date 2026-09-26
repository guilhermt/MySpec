import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { dashedDisabled, focusRing, paintOf, setTheme, THEMES, token } from "@/test/painted";
import { Chip } from "./Chip";

describe.each(THEMES)("Chip in the %s theme", (theme) => {
  it("rests on the raised surface with the quiet line", () => {
    setTheme(theme);
    render(<Chip kind="toggle">Assigned to me</Chip>);
    const want = {
      background: token("--surface-2"),
      color: token("--ink-2"),
      border: token("--line-2"),
      height: "28px",
    };
    expect(paintOf(screen.getByRole("button", { name: "Assigned to me" }), want)).toEqual(want);
  });

  it("steps up on hover", async () => {
    setTheme(theme);
    render(<Chip kind="toggle">Assigned to me</Chip>);
    const chip = screen.getByRole("button", { name: "Assigned to me" });
    await userEvent.hover(chip);
    const want = { background: token("--surface-2-hover"), color: token("--ink-1") };
    expect(paintOf(chip, want)).toEqual(want);
  });

  it("keeps the chosen tint and ring under the pointer", async () => {
    setTheme(theme);
    render(
      <Chip kind="toggle" pressed>
        Assigned to me
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Assigned to me" });
    await userEvent.hover(chip);
    const want = {
      background: token("--brand-tint"),
      color: token("--brand-ink"),
      border: token("--brand-ring"),
    };
    expect(paintOf(chip, want)).toEqual(want);
  });

  it("paints the open menu chip as chosen", async () => {
    setTheme(theme);
    render(
      <Chip kind="menu" aria-expanded>
        Opus · high
      </Chip>,
    );
    const want = { background: token("--brand-tint"), color: token("--brand-ink") };
    expect(paintOf(screen.getByRole("button", { name: "Opus · high" }), want)).toEqual(want);
  });

  it("writes its own choice in the strong ink with the control line", () => {
    setTheme(theme);
    render(
      <Chip kind="menu" own>
        Opus · high
      </Chip>,
    );
    const want = { color: token("--ink-1"), border: token("--line-3") };
    expect(paintOf(screen.getByRole("button", { name: "Opus · high" }), want)).toEqual(want);
  });

  it("shows the focus ring", async () => {
    setTheme(theme);
    render(<Chip kind="toggle">Assigned to me</Chip>);
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(screen.getByRole("button", { name: "Assigned to me" }), want)).toEqual(want);
  });

  it("is dashed when disabled, also under the pointer", async () => {
    setTheme(theme);
    render(
      <Chip kind="toggle" disabled disabledReason="No tasks yet">
        Assigned to me
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Assigned to me" });
    await userEvent.hover(chip);
    const want = dashedDisabled();
    expect(paintOf(chip, want)).toEqual(want);
  });
});
