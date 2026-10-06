import { render, screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  dashedDisabled,
  focusRing,
  type Paint,
  paintOf,
  setTheme,
  THEMES,
  TRANSPARENT,
  token,
} from "@/test/painted";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "new";

/** VARIANTS is the rest and hover paint of each variant, as components.md, Botão, has them. */
const VARIANTS: Record<Variant, { rest: () => Paint; hover: () => Paint }> = {
  secondary: {
    rest: () => ({
      background: token("--surface-2"),
      color: token("--ink-2"),
      border: token("--line-2"),
    }),
    hover: () => ({ background: token("--surface-2-hover"), color: token("--ink-1") }),
  },
  primary: {
    rest: () => ({
      background: token("--brand"),
      color: token("--brand-on"),
      border: token("--brand"),
    }),
    hover: () => ({ background: token("--brand-hover"), border: token("--brand-hover") }),
  },
  danger: {
    rest: () => ({
      background: token("--state-error"),
      color: token("--state-error-on"),
      border: token("--state-error"),
    }),
    hover: () => ({
      background: token("--state-error-hover"),
      border: token("--state-error-hover"),
    }),
  },
  ghost: {
    rest: () => ({ background: TRANSPARENT, color: token("--ink-2") }),
    hover: () => ({ background: token("--veil-hover"), color: token("--ink-1") }),
  },
  new: {
    rest: () => ({ background: token("--surface-2"), color: token("--brand-ink") }),
    hover: () => ({ background: token("--brand-tint-hover") }),
  },
};

const NAMES = Object.keys(VARIANTS) as Variant[];

describe.each(THEMES)("Button in the %s theme", (theme) => {
  it.each(NAMES)("paints the %s variant at rest", (variant) => {
    setTheme(theme);
    render(<Button variant={variant}>Approve</Button>);
    const want = VARIANTS[variant].rest();
    expect(paintOf(screen.getByRole("button", { name: "Approve" }), want)).toEqual(want);
  });

  it.each(NAMES)("paints the %s variant on hover", async (variant) => {
    setTheme(theme);
    render(<Button variant={variant}>Approve</Button>);
    const button = screen.getByRole("button", { name: "Approve" });
    await userEvent.hover(button);
    const want = VARIANTS[variant].hover();
    expect(paintOf(button, want)).toEqual(want);
  });

  it.each(NAMES)("shows the focus ring on the %s variant", async (variant) => {
    setTheme(theme);
    render(<Button variant={variant}>Approve</Button>);
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(screen.getByRole("button", { name: "Approve" }), want)).toEqual(want);
  });

  it.each(NAMES)(
    "is dashed when the %s variant is disabled, also under the pointer",
    async (variant) => {
      setTheme(theme);
      render(
        <Button variant={variant} disabled disabledReason="Finish the step first">
          Approve
        </Button>,
      );
      const button = screen.getByRole("button", { name: "Approve" });
      await userEvent.hover(button);
      const want = dashedDisabled();
      expect(paintOf(button, want)).toEqual(want);
    },
  );

  it("says what is missing before the dashed button, on its line", () => {
    setTheme(theme);
    render(
      <Button variant="primary" shortcut="Ctrl ↵" disabled disabledReason="Decide 2 more">
        Publish review…
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Publish review…" }).getBoundingClientRect();
    const reason = screen.getByText("Decide 2 more").getBoundingClientRect();
    expect(reason.right).toBeLessThanOrEqual(button.left);
    expect(reason.top).toBeGreaterThanOrEqual(button.top);
    expect(reason.bottom).toBeLessThanOrEqual(button.bottom);
  });

  it("keeps the key of a dashed primary in sight, as the key of a dashed secondary", () => {
    setTheme(theme);
    render(
      <>
        <Button variant="primary" shortcut="Ctrl ↵" disabled disabledReason="Name the task">
          Create
        </Button>
        <Button shortcut="Esc" disabled disabledReason="Creating the task">
          Cancel
        </Button>
      </>,
    );
    const keyOf = (name: string) =>
      screen.getByRole("button", { name }).querySelector("kbd") as Element;
    const want = paintOf(keyOf("Cancel"), { color: "", background: "", border: "" });
    expect(paintOf(keyOf("Create"), want)).toEqual(want);
  });

  it("boxes the key of every button, in the line of its variant", () => {
    setTheme(theme);
    render(
      <>
        <Button shortcut="Esc">Close</Button>
        <Button variant="ghost" shortcut="N">
          New discussion
        </Button>
        <Button variant="primary" shortcut="Ctrl ↵">
          Send
        </Button>
        <Button shortcut="Esc" disabled disabledReason="Creating the task">
          Cancel
        </Button>
      </>,
    );
    const keyOf = (name: string) =>
      screen.getByRole("button", { name }).querySelector("kbd") as Element;
    for (const name of ["Close", "New discussion"]) {
      const want = { border: token("--line-2"), borderStyle: "solid" };
      expect(paintOf(keyOf(name), want)).toEqual(want);
    }
    expect(getComputedStyle(keyOf("Send")).boxShadow).toContain(token("--brand-key-ring"));
    const dashed = { border: token("--line-1"), color: token("--ink-4"), borderStyle: "solid" };
    expect(paintOf(keyOf("Cancel"), dashed)).toEqual(dashed);
  });

  it("keeps the width of a primary button whether it is dashed or not", () => {
    setTheme(theme);
    const { rerender } = render(
      <Button variant="primary" shortcut="Ctrl ↵">
        Create
      </Button>,
    );
    const width = () =>
      screen.getByRole("button", { name: "Create" }).getBoundingClientRect().width;
    const active = width();
    rerender(
      <Button variant="primary" shortcut="Ctrl ↵" disabled disabledReason="Name the task">
        Create
      </Button>,
    );
    expect(width()).toBe(active);
  });

  it("paints the error in the error ink on its veil", () => {
    setTheme(theme);
    render(<Button error>Try again</Button>);
    const want = {
      background: token("--state-error-veil"),
      color: token("--state-error"),
      border: token("--state-error"),
    };
    expect(paintOf(screen.getByRole("button", { name: "Try again" }), want)).toEqual(want);
  });

  it("keeps a pressed ghost in the panel tint, also under the pointer", async () => {
    setTheme(theme);
    render(
      <Button variant="ghost" pressed>
        Diff
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Diff" });
    await userEvent.hover(button);
    const want = { background: token("--brand-tint-plane"), color: token("--brand-ink") };
    expect(paintOf(button, want)).toEqual(want);
  });

  it("keeps a pressed secondary in the brand tint, also under the pointer", async () => {
    setTheme(theme);
    render(<Button pressed>Approve</Button>);
    const button = screen.getByRole("button", { name: "Approve" });
    await userEvent.hover(button);
    const want = { background: token("--brand-tint"), color: token("--brand-ink") };
    expect(paintOf(button, want)).toEqual(want);
  });

  it("measures the three heights of the system", () => {
    setTheme(theme);
    render(
      <>
        <Button>Medium</Button>
        <Button size="sm">Small</Button>
        <Button size="xs">Tiny</Button>
      </>,
    );
    expect(paintOf(screen.getByRole("button", { name: "Medium" }), { height: "" })).toEqual({
      height: "32px",
    });
    expect(paintOf(screen.getByRole("button", { name: "Small" }), { height: "" })).toEqual({
      height: "28px",
    });
    expect(paintOf(screen.getByRole("button", { name: "Tiny" }), { height: "" })).toEqual({
      height: "22px",
    });
  });
});

describe.each(THEMES)("IconButton in the %s theme", (theme) => {
  it("is a ghost square with the veil on hover", async () => {
    setTheme(theme);
    render(<IconButton label="Settings" icon={Settings} />);
    const button = screen.getByRole("button", { name: "Settings" });
    expect(paintOf(button, { background: "" })).toEqual({ background: TRANSPARENT });
    await userEvent.hover(button);
    const want = { background: token("--veil-hover"), color: token("--ink-1") };
    expect(paintOf(button, want)).toEqual(want);
    expect(button.getBoundingClientRect().width).toBe(32);
  });

  it("shows the focus ring", async () => {
    setTheme(theme);
    render(<IconButton label="Settings" icon={Settings} />);
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(screen.getByRole("button", { name: "Settings" }), want)).toEqual(want);
  });

  it("is dashed when disabled", () => {
    setTheme(theme);
    render(
      <IconButton
        label="Settings"
        icon={Settings}
        disabled
        disabledReason="A session is running"
      />,
    );
    const want = dashedDisabled();
    expect(paintOf(screen.getByRole("button", { name: "Settings" }), want)).toEqual(want);
  });
});
