import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelPicker } from "@/features/models/ModelPicker";
import type { ModelChoice } from "@/lib/models";
import { renderWithStore } from "@/test/render";

const CHOICE: ModelChoice = { model: "claude-opus-5", effort: "high" };

function picker(onChange = vi.fn()) {
  const rendered = renderWithStore(<ModelPicker label="PRD" onChange={onChange} value={CHOICE} />);
  return { ...rendered, onChange };
}

function trigger() {
  return screen.getByRole("button", { name: "PRD model: Opus 5 · high" });
}

describe("ModelPicker", () => {
  it("writes the choice as the whole interface does", () => {
    picker();

    expect(trigger()).toHaveTextContent("Opus 5 · high");
  });

  it("changes the model and keeps the effort, with the menu still open", async () => {
    const { user, onChange } = picker();

    await user.click(trigger());
    await user.click(await screen.findByRole("menuitemradio", { name: "Fable 5.1" }));

    expect(onChange).toHaveBeenCalledWith({ model: "claude-fable-5-1", effort: "high" });
    expect(screen.getByRole("menuitemradio", { name: "max" })).toBeInTheDocument();
  });

  it("changes the effort and keeps the model", async () => {
    const { user, onChange } = picker();

    await user.click(trigger());
    await user.click(await screen.findByRole("menuitemradio", { name: "max" }));

    expect(onChange).toHaveBeenCalledWith({ model: "claude-opus-5", effort: "max" });
  });

  it("calls nothing for what is already checked", async () => {
    const { user, onChange } = picker();

    await user.click(trigger());
    await user.click(await screen.findByRole("menuitemradio", { name: "Opus 5" }));
    await user.click(screen.getByRole("menuitemradio", { name: "high" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens from the keyboard", async () => {
    const { user } = picker();

    trigger().focus();
    await user.keyboard("{Enter}");

    expect(await screen.findAllByRole("menuitemradio")).toHaveLength(8);
  });
});
