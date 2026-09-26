import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Chip } from "./Chip";

function Toggling() {
  const [pressed, setPressed] = useState(false);
  return (
    <Chip kind="toggle" pressed={pressed} onPressedChange={setPressed}>
      Open
    </Chip>
  );
}

describe("Chip", () => {
  it("toggles and reports aria-pressed", async () => {
    const { user } = renderWithStore(<Toggling />);
    const chip = screen.getByRole("button", { name: "Open" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a menu", () => {
    renderWithStore(
      <Chip kind="menu" aria-haspopup="menu">
        Model
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "Model" })).toHaveAttribute("aria-haspopup", "menu");
  });

  it("is tinted when chosen", () => {
    renderWithStore(
      <Chip kind="toggle" pressed>
        Open
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Open" });
    expect(chip).toHaveClass("aria-pressed:bg-brand-tint", "rounded-(--radius-pill)");
    expect(chip).not.toHaveClass("aria-pressed:bg-muted", "rounded-lg");
    expect(chip).not.toHaveClass("not-aria-disabled:hover:bg-surface-2-hover");
  });

  it("marks the person's own choice", async () => {
    const { user } = renderWithStore(
      <Chip kind="menu" own defaultNote="Factory default: Fable 5.1 · high">
        Opus 5.5
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "Opus 5.5" })).toHaveClass("text-ink-1");
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Factory default: Fable 5.1 · high",
    );
  });

  it("shows an unavailable choice without changing it", async () => {
    const onPressedChange = vi.fn();
    const { user } = renderWithStore(
      <Chip kind="toggle" unavailableReason="Not in this plan" onPressedChange={onPressedChange}>
        Fable
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Fable · unavailable" });
    expect(chip.querySelector('[data-state="blocked"]')).not.toBeNull();
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Not in this plan");
    await user.click(chip);
    expect(onPressedChange).not.toHaveBeenCalled();
  });

  it("removes itself with its own button", async () => {
    const onRemove = vi.fn();
    const { user } = renderWithStore(
      <Chip kind="toggle" pressed onRemove={onRemove} removeLabel="Remove filter Open">
        Open
      </Chip>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
    await user.tab();
    const remove = screen.getByRole("button", { name: "Remove filter Open" });
    expect(remove).toHaveFocus();
    await user.click(remove);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("has the hover of the system", () => {
    renderWithStore(<Chip kind="toggle">Open</Chip>);
    expect(screen.getByRole("button", { name: "Open" })).toHaveClass(
      "not-aria-disabled:not-aria-pressed:not-aria-expanded:hover:bg-surface-2-hover",
    );
  });

  it("takes the focus with the focus ring", async () => {
    const { user } = renderWithStore(<Chip kind="toggle">Open</Chip>);
    await user.tab();
    const chip = screen.getByRole("button", { name: "Open" });
    expect(chip).toHaveFocus();
    expect(chip).toHaveClass("focus-visible:focus-ring");
  });

  it("stays focusable while disabled and tells the reason", async () => {
    const onPressedChange = vi.fn();
    const { user } = renderWithStore(
      <Chip kind="toggle" disabled disabledReason="No tasks yet" onPressedChange={onPressedChange}>
        Open
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Open" });
    expect(chip).toHaveAttribute("aria-disabled", "true");
    expect(chip).toHaveAccessibleDescription("No tasks yet");
    expect(chip).toHaveClass("aria-disabled:dashed-disabled");
    expect(chip).not.toHaveClass("disabled:opacity-50");
    await user.click(chip);
    expect(onPressedChange).not.toHaveBeenCalled();
  });

  it("is busy while loading and ignores the click", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(
      <Chip kind="menu" size="xs" loading loadingLabel="Saving…" onClick={onClick}>
        Model
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Saving…" });
    expect(chip).toHaveAttribute("aria-busy", "true");
    expect(chip).toHaveClass("h-(--size-control-xs)");
    await user.click(chip);
    expect(onClick).not.toHaveBeenCalled();
  });
});
