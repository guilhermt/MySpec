import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { type Paint, paintOf, resolve, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { Select } from "./Select";

const OPTIONS = [
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
];

function Subject({ disabled, loading }: { disabled?: boolean; loading?: boolean }) {
  return (
    <Select
      label="Model"
      value="opus"
      options={OPTIONS}
      onValueChange={() => {}}
      {...(loading ? { loading } : {})}
      {...(disabled ? { disabled, disabledReason: "The session is running" } : {})}
    />
  );
}

/** fieldAt is the paint of a field trigger with the given border and shadow. */
function fieldAt(border: `--${string}`, shadow = "none"): Paint {
  return {
    background: token("--surface-input"),
    color: token("--ink-1"),
    border: token(border),
    borderStyle: "solid",
    shadow,
  };
}

describe.each(THEMES)("Select in the %s theme", (theme) => {
  it("has the anatomy of the input", () => {
    setTheme(theme);
    render(<Subject />);
    const want = fieldAt("--line-3");
    expect(paintOf(screen.getByRole("button", { name: "Model: Opus" }), want)).toEqual(want);
  });

  it("darkens its border on hover", async () => {
    setTheme(theme);
    render(<Subject />);
    const trigger = screen.getByRole("button", { name: "Model: Opus" });
    await userEvent.hover(trigger);
    const want = fieldAt("--ink-3");
    expect(paintOf(trigger, want)).toEqual(want);
  });

  it("shows focus on its border, with the halo", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.tab();
    const want = fieldAt("--focus", resolve("0 0 0 var(--halo) var(--focus-halo)", "box-shadow"));
    expect(paintOf(screen.getByRole("button", { name: "Model: Opus" }), want)).toEqual(want);
  });

  it("keeps the focus border while open", async () => {
    setTheme(theme);
    render(<Subject />);
    const trigger = screen.getByRole("button", { name: "Model: Opus" });
    await userEvent.click(trigger);
    await screen.findByRole("menu");
    expect(paintOf(trigger, { border: "" })).toEqual({ border: token("--focus") });
  });

  it("checks the chosen option in the brand ink", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.click(screen.getByRole("button", { name: "Model: Opus" }));
    const chosen = await screen.findByRole("menuitemradio", { name: "Opus" });
    const check = chosen.querySelector("svg");
    expect(check).not.toBeNull();
    if (check !== null)
      expect(paintOf(check, { color: "" })).toEqual({ color: token("--brand-ink") });
  });

  it("is dashed when disabled", () => {
    setTheme(theme);
    render(<Subject disabled />);
    const want = {
      background: TRANSPARENT,
      color: token("--ink-4"),
      border: token("--line-3"),
      borderStyle: "dashed",
    };
    expect(paintOf(screen.getByRole("button", { name: "Model: Opus" }), want)).toEqual(want);
  });

  it("shimmers the saved choice while the choices are read", () => {
    setTheme(theme);
    render(<Subject loading />);
    const choice = screen.getByText("Opus");
    expect(getComputedStyle(choice).animationName).toBe("shimmer");
  });
});
