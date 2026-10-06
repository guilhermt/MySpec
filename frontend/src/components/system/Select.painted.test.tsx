import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { type Paint, paintOf, resolve, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { Select } from "./Select";

const OPTIONS = [
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
];

function Subject({
  disabled,
  loading,
  sidebar,
  xs,
}: {
  disabled?: boolean;
  loading?: boolean;
  sidebar?: boolean;
  xs?: boolean;
}) {
  return (
    <Select
      label="Model"
      value="opus"
      options={OPTIONS}
      onValueChange={() => {}}
      {...(sidebar ? { variant: "sidebar" as const } : {})}
      {...(xs ? { size: "xs" as const } : {})}
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

  it("takes the tone of the sidebar as its trigger", () => {
    setTheme(theme);
    render(<Subject sidebar />);
    const want = {
      background: token("--sidebar-input"),
      border: token("--sidebar-control"),
      color: token("--ink-2"),
      height: resolve("var(--size-control-sm)", "height"),
      fontSize: resolve("var(--text-meta)", "font-size"),
    };
    expect(paintOf(screen.getByRole("button", { name: "Model: Opus" }), want)).toEqual(want);
  });

  it("fits a row at the xs size, with the choice in the meta size", () => {
    setTheme(theme);
    render(<Subject xs />);
    const want = {
      ...fieldAt("--line-3"),
      height: resolve("var(--size-control-xs)", "height"),
      fontSize: resolve("var(--text-meta)", "font-size"),
    };
    expect(paintOf(screen.getByRole("button", { name: "Model: Opus" }), want)).toEqual(want);
  });
});

describe("Select, the width of its menu", () => {
  it("is never narrower than its trigger", async () => {
    render(
      <div style={{ width: "var(--size-dialog)" }}>
        <Subject sidebar />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "Model: Opus" });
    await userEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    // offsetWidth is the width of the layout, before the scale the menu opens with.
    expect(trigger.offsetWidth).toBeGreaterThan(
      parseFloat(resolve("var(--size-menu-min)", "width")),
    );
    expect(menu.offsetWidth).toBeGreaterThanOrEqual(trigger.offsetWidth);
  });
});

describe("Select, a menu with a long reason and an action", () => {
  const LONG =
    "The clone at ~/projects/some/deeply/nested/folder/of/a/very/long/path/to/api is missing.";

  function Repositories() {
    return (
      <div style={{ width: "var(--size-menu-min)" }}>
        <Select
          label="Repository"
          value=""
          placeholder="Choose a repository"
          options={[
            { value: "web", label: "dev/web" },
            { value: "api", label: "dev/api", sub: LONG, disabled: true },
            {
              value: "infra",
              label: "dev/infra",
              sub: "Not cloned",
              disabled: true,
              action: { label: "Clone", onAction: () => {} },
            },
          ]}
          onValueChange={() => {}}
        />
      </div>
    );
  }

  it("stops at --size-menu-max, cuts the reason and lines the labels up", async () => {
    render(<Repositories />);
    await userEvent.click(screen.getByRole("button", { name: /^Repository/ }));
    const menu = await screen.findByRole("menu");

    // offsetWidth is the width of the layout, before the scale the menu opens with.
    const max = parseFloat(resolve("var(--size-menu-max)", "width"));
    expect(max).toBe(320);
    expect(menu.offsetWidth).toBeLessThanOrEqual(max);
    expect(menu.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);

    const left = (name: string) => screen.getByText(name).getBoundingClientRect().left;
    expect(left("dev/api")).toBe(left("dev/web"));
    expect(left("dev/infra")).toBe(left("dev/web"));

    const reason = screen.getByText(LONG);
    expect(reason.scrollWidth).toBeGreaterThan(reason.clientWidth);
  });
});
