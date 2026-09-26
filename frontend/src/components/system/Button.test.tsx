import { screen } from "@testing-library/react";
import { Check } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Button } from "./Button";

describe("Button", () => {
  it.each([
    ["secondary", "bg-surface-2"],
    ["primary", "bg-brand"],
    ["danger", "bg-state-error"],
    ["ghost", "bg-transparent"],
    ["new", "text-brand-ink"],
  ] as const)("applies the %s variant", (variant, token) => {
    renderWithStore(<Button variant={variant}>Approve</Button>);
    expect(screen.getByRole("button", { name: "Approve" })).toHaveClass(token);
  });

  it("is secondary by default", () => {
    renderWithStore(<Button>Approve</Button>);
    const button = screen.getByRole("button", { name: "Approve" });
    expect(button).toHaveClass("bg-surface-2", "h-(--size-control)", "rounded-sm");
    expect(button).not.toHaveClass("bg-primary", "rounded-lg");
  });

  it("uses the small and extra small sizes", () => {
    renderWithStore(
      <>
        <Button size="sm">Small</Button>
        <Button size="xs" icon={Check}>
          Tiny
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Small" })).toHaveClass("h-(--size-control-sm)");
    expect(screen.getByRole("button", { name: "Tiny" })).toHaveClass("h-(--size-control-xs)");
  });

  it("shows the error state", () => {
    renderWithStore(<Button error>Retry</Button>);
    expect(screen.getByRole("button", { name: "Retry" })).toHaveClass(
      "border-state-error",
      "text-state-error",
      "bg-state-error-veil",
    );
  });

  it("has the hover of the system", () => {
    renderWithStore(
      <>
        <Button>Cancel</Button>
        <Button variant="primary">Approve</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass(
      "not-aria-disabled:hover:bg-surface-2-hover",
    );
    expect(screen.getByRole("button", { name: "Approve" })).toHaveClass(
      "not-aria-disabled:hover:bg-brand-hover",
    );
  });

  it("takes the focus with the focus ring", async () => {
    const { user } = renderWithStore(<Button>Approve</Button>);
    await user.tab();
    const button = screen.getByRole("button", { name: "Approve" });
    expect(button).toHaveFocus();
    expect(button).toHaveClass("focus-visible:focus-ring");
  });

  it("stays focusable while disabled and tells the reason", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(
      <Button disabled disabledReason="Finish the step first" onClick={onClick}>
        Approve
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Approve" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Finish the step first");
    expect(button).toHaveClass("aria-disabled:dashed-disabled");
    expect(button).not.toHaveClass("disabled:opacity-50");
    await user.tab();
    expect(button).toHaveFocus();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("points to a reason elsewhere", () => {
    renderWithStore(
      <>
        <p id="footer-reason">Resolve the conflicts first</p>
        <Button disabled reasonId="footer-reason">
          Merge
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Merge" })).toHaveAccessibleDescription(
      "Resolve the conflicts first",
    );
  });

  it("is busy while loading and ignores the click", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(
      <Button variant="primary" loading loadingLabel="Approving…" onClick={onClick}>
        Approve
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Approving…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("cursor-progress");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls the handler when clicked", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(<Button onClick={onClick}>Approve</Button>);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps the key out of the accessible name", () => {
    renderWithStore(
      <Button variant="primary" shortcut="Ctrl ↵">
        Publish review…
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Publish review…" })).toHaveTextContent("Ctrl ↵");
  });

  it("rings the key on a solid button and bares it elsewhere", () => {
    renderWithStore(
      <>
        <Button variant="primary" shortcut="Enter">
          Approve
        </Button>
        <Button shortcut="Esc">Cancel</Button>
      </>,
    );
    const ringed = screen.getByRole("button", { name: "Approve" }).querySelector("kbd");
    expect(ringed).toHaveClass(
      "text-brand-on",
      "shadow-[inset_0_0_0_var(--border)_var(--brand-key-ring)]",
      "px-1",
    );
    expect(ringed).not.toHaveClass("shadow-none");
    const bare = screen.getByRole("button", { name: "Cancel" }).querySelector("kbd");
    expect(bare).toHaveClass("border-0", "bg-transparent", "px-0", "shadow-none");
  });

  it("marks the pressed ghost", () => {
    renderWithStore(
      <Button variant="ghost" pressed>
        Diff
      </Button>,
    );
    const diff = screen.getByRole("button", { name: "Diff" });
    expect(diff).toHaveAttribute("aria-pressed", "true");
    // Hover keeps the chosen look.
    expect(diff).toHaveClass("not-aria-disabled:not-aria-pressed:hover:bg-veil-hover");
    expect(diff).not.toHaveClass("not-aria-disabled:hover:bg-veil-hover");
  });
});
