import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Chip, type ChipProps } from "./Chip";

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

  it("is pressed when chosen", () => {
    renderWithStore(
      <Chip kind="toggle" pressed>
        Open
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-pressed", "true");
  });

  it("marks the person's own choice", async () => {
    const { user } = renderWithStore(
      <Chip kind="menu" own defaultNote="Factory default: Fable 5.1 · high">
        Opus 5.5
      </Chip>,
    );
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

  it("takes the focus", async () => {
    const { user } = renderWithStore(<Chip kind="toggle">Open</Chip>);
    await user.tab();
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
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
    await user.click(chip);
    expect(onPressedChange).not.toHaveBeenCalled();
  });

  it("is busy while loading and ignores the click", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(
      <Chip kind="menu" size="sm" loading loadingLabel="Saving…" onClick={onClick}>
        Model
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Saving…" });
    expect(chip).toHaveAttribute("aria-busy", "true");
    await user.click(chip);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps the saved choice as its name while the catalog is read, without a spinner", () => {
    renderWithStore(
      <Chip kind="menu" reading>
        Opus · high
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Opus · high" });
    expect(chip).toHaveAttribute("aria-busy", "true");
    expect(chip.querySelector("[data-tone]")).toBeNull();
  });

  it("tells the error with its glyph, and the reason in its description and tooltip", async () => {
    const { user } = renderWithStore(
      <Chip kind="menu" errorReason="Opus 4 is no longer offered">
        Opus 4
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "Opus 4" });
    expect(chip).toHaveAccessibleDescription("Opus 4 is no longer offered");
    expect(chip.querySelector('[data-state="error"]')).not.toBeNull();
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Opus 4 is no longer offered");
  });

  it("requires the gerund to load, by its type", () => {
    // @ts-expect-error: a loading chip without its gerund would have no name.
    const unnamed: ChipProps = { kind: "menu", loading: true, children: "Opus" };
    expect(unnamed.loading).toBe(true);
  });

  it("names its remove button Remove by default", () => {
    renderWithStore(
      <Chip kind="toggle" pressed onRemove={() => {}}>
        Open
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });
});
