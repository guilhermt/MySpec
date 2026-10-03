import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModelChoice } from "@/lib/models";
import type { ModelCatalog } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeModelCatalog, makeState } from "@/test/wails-mock";
import { ModelChip, type ModelChipProps } from "./ModelChip";

const OPUS: ModelChoice = { model: "claude-opus-5-5[1m]", effort: "high" };

function renderChip(
  props: Partial<ModelChipProps> = {},
  catalog: ModelCatalog = makeModelCatalog(),
) {
  const onChange = props.onChange ?? vi.fn();
  const rendered = renderWithStore(
    <ModelChip
      value={OPUS}
      label="Step 5"
      own={false}
      followNote="Follows Implementation"
      {...props}
      onChange={onChange}
    />,
    { state: makeState({ modelCatalog: catalog }) },
  );
  return { ...rendered, onChange };
}

describe("ModelChip", () => {
  it("names the choice and what it is for, and says it opens a menu", () => {
    renderChip();
    const chip = screen.getByRole("button", { name: "Step 5 model: Opus 5.5 (1M) · high" });
    expect(chip).toHaveAttribute("aria-haspopup", "menu");
    expect(chip).toHaveTextContent("Opus 5.5 (1M) · high");
  });

  it("says what a choice that follows another follows, in the tooltip and the description", async () => {
    const { user } = renderChip();
    const chip = screen.getByRole("button", { name: /Step 5 model/ });
    expect(chip).toHaveAccessibleDescription("Follows Implementation");
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Follows Implementation");
  });

  it("says what an own choice sets aside, in the tooltip and the description", async () => {
    const { user } = renderChip({
      own: true,
      followNote: "Its own model · Implementation uses Sonnet · high",
    });
    const chip = screen.getByRole("button", { name: /Step 5 model/ });
    expect(chip).toHaveAccessibleDescription("Its own model · Implementation uses Sonnet · high");
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Its own model · Implementation uses Sonnet · high",
    );
  });

  it("has no note when there is nothing to follow", () => {
    renderChip({ followNote: "" });
    expect(screen.getByRole("button", { name: /Step 5 model/ })).not.toHaveAttribute(
      "aria-describedby",
    );
  });

  it("opens the models and the efforts of the chosen model, the choice checked", async () => {
    const { user } = renderChip();
    await user.click(screen.getByRole("button", { name: /Step 5 model/ }));
    expect(await screen.findByRole("menu")).toHaveTextContent("Model");
    expect(screen.getByText("Effort · Opus 5.5 (1M)")).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Opus 5.5 (1M)" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Sonnet 5" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("menuitemradio", { name: "high" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("changes the model and keeps the effort", async () => {
    const { user, onChange } = renderChip();
    await user.click(screen.getByRole("button", { name: /Step 5 model/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Sonnet 5" }));
    expect(onChange).toHaveBeenCalledWith({ model: "claude-sonnet-5", effort: "high" });
  });

  it("changes the effort and keeps the model", async () => {
    const { user, onChange } = renderChip();
    await user.click(screen.getByRole("button", { name: /Step 5 model/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "low" }));
    expect(onChange).toHaveBeenCalledWith({ model: "claude-opus-5-5[1m]", effort: "low" });
  });

  it("says a model that takes no effort has no effort levels", async () => {
    const { user } = renderChip({ value: { model: "claude-haiku-4-5-20251001", effort: "" } });
    await user.click(screen.getByRole("button", { name: "Step 5 model: Haiku 4.5" }));
    expect(await screen.findByText("Haiku 4.5 has no effort levels.")).toBeInTheDocument();
  });

  it("saves with the spinner and the gerund, and opens nothing meanwhile", async () => {
    const { user } = renderChip({ saving: true });
    const chip = screen.getByRole("button", { name: /Step 5 model/ });
    expect(chip).toHaveTextContent("Saving…");
    expect(chip).toHaveAttribute("aria-busy", "true");
    await user.click(chip);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps the saved choice, busy, while the catalog is read, with a menu that stays shut and says so", async () => {
    const { user } = renderChip({}, makeModelCatalog({ models: [] }));
    const chip = screen.getByRole("button", { name: "Step 5 model: Opus 5.5 (1M) · high" });
    expect(chip).toHaveAttribute("aria-busy", "true");
    expect(chip).toHaveAccessibleDescription(
      "Reading the models of Claude Code · the menu opens when it ends",
    );
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Reading the models of Claude Code · the menu opens when it ends",
    );
    await user.click(chip);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByText(/unavailable/)).not.toBeInTheDocument();
  });

  it("says the same while an own choice reads, and not its own note", async () => {
    renderChip(
      { own: true, followNote: "Its own model · Implementation uses Sonnet · high" },
      makeModelCatalog({ models: [] }),
    );
    expect(screen.getByRole("button", { name: /Step 5 model/ })).toHaveAccessibleDescription(
      "Reading the models of Claude Code · the menu opens when it ends",
    );
  });

  it("marks a choice the installed Claude Code no longer offers, without changing it", async () => {
    const { user, onChange } = renderChip({ value: { model: "claude-opus-4", effort: "high" } });
    const chip = screen.getByRole("button", { name: "Step 5 model: Opus 4 · high · unavailable" });
    expect(chip).toHaveTextContent("Opus 4 · high · unavailable");
    const reason =
      "The installed Claude Code no longer lists Opus 4. A session still starts with it, and the CLI decides.";
    expect(chip).toHaveAccessibleDescription(reason);
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
    await user.click(chip);
    const kept = await screen.findByRole("menuitemradio", {
      name: `◇ Opus 4 · unavailable ${reason}`,
    });
    expect(kept).toHaveAttribute("aria-checked", "true");
    expect(kept).toHaveAttribute("aria-disabled", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says why there is nothing to offer when the catalog was never read", async () => {
    const { user } = renderChip({}, makeModelCatalog({ models: [], failure: "not_found" }));
    const chip = screen.getByRole("button", { name: "Step 5 model: Opus 5.5 (1M) · high" });
    expect(chip).not.toHaveAttribute("aria-busy");
    await user.click(chip);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Claude Code was not found. Install it or point MYSPEC_CLAUDE_PATH at the executable.",
    );
    expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
  });

  it("says an effort the model doesn't offer, with the reason of the effort", () => {
    renderChip({ value: { model: "claude-sonnet-5", effort: "ultra" } });
    expect(
      screen.getByRole("button", { name: "Step 5 model: Sonnet 5 · ultra · unavailable" }),
    ).toHaveAccessibleDescription(
      "The installed Claude Code doesn't offer ultra for Sonnet 5. A session still starts with it, and the CLI decides.",
    );
  });

  it("takes the whole accessible name it is given", () => {
    renderChip({ accessibleName: "PRD: Opus 5.5 (1M) · high, the factory default" });
    expect(
      screen.getByRole("button", { name: "PRD: Opus 5.5 (1M) · high, the factory default" }),
    ).toBeInTheDocument();
  });

  it("marks no factory choice in the menu unless it is given one", async () => {
    const { user } = renderChip();
    await user.click(screen.getByRole("button", { name: /Step 5 model/ }));
    await screen.findByRole("menu");
    expect(screen.getByRole("menuitemradio", { name: "Opus 5.5 (1M)" })).not.toHaveTextContent(
      "factory",
    );
    expect(screen.queryByText(/read when MySpec opened/)).not.toBeInTheDocument();
  });

  it("marks the factory model, and its effort only on that model, and says where the list comes from", async () => {
    const { user } = renderChip({ factory: { model: "claude-sonnet-5", effort: "medium" } });
    await user.click(screen.getByRole("button", { name: /Step 5 model/ }));
    await screen.findByRole("menu");
    expect(screen.getByRole("menuitemradio", { name: /^Sonnet 5/ })).toHaveTextContent("factory");
    expect(screen.getByRole("menuitemradio", { name: /^Opus 5.5/ })).not.toHaveTextContent(
      "factory",
    );
    // The chosen model is Opus, so no effort carries the mark.
    expect(screen.getByRole("menuitemradio", { name: "medium" })).toBeInTheDocument();
    expect(
      screen.getByText("From the Claude Code installed here, read when MySpec opened."),
    ).toBeInTheDocument();
  });

  it("marks the factory effort when the chosen model is the factory one", async () => {
    const { user } = renderChip({ factory: { model: "claude-opus-5-5[1m]", effort: "medium" } });
    await user.click(screen.getByRole("button", { name: /Step 5 model/ }));
    await screen.findByRole("menu");
    expect(screen.getByRole("menuitemradio", { name: /^medium/ })).toHaveTextContent("factory");
    expect(screen.getByRole("menuitemradio", { name: /^high/ })).not.toHaveTextContent("factory");
  });

  it("closes its menu on Escape and gives the focus back to the chip", async () => {
    const { user } = renderChip();
    const chip = screen.getByRole("button", { name: /Step 5 model/ });
    await user.click(chip);
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(chip).toHaveFocus();
  });
});
