import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelPicker } from "@/features/models/ModelPicker";
import type { ModelChoice } from "@/lib/models";
import type { ModelCatalog } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeCatalogModel, makeModelCatalog, makeState } from "@/test/wails-mock";

const CHOICE: ModelChoice = { model: "claude-opus-5-5[1m]", effort: "high" };

function picker(choice: ModelChoice = CHOICE, catalog: ModelCatalog = makeModelCatalog()) {
  const onChange = vi.fn();
  const rendered = renderWithStore(<ModelPicker label="PRD" onChange={onChange} value={choice} />, {
    state: makeState({ modelCatalog: catalog }),
  });
  return { ...rendered, onChange };
}

function trigger(name = "PRD model: Opus 5.5 (1M) · high") {
  return screen.getByRole("button", { name });
}

/** names is the text of every radio item the open menu offers. */
function names() {
  return screen.getAllByRole("menuitemradio").map((item) => item.textContent);
}

describe("ModelPicker", () => {
  it("writes the choice as the whole interface does", () => {
    picker();

    expect(trigger()).toHaveTextContent("Opus 5.5 (1M) · high");
  });

  it("lists the models of the catalog by their derived names", async () => {
    const { user } = picker();

    await user.click(trigger());

    expect(await screen.findByRole("menuitemradio", { name: "Opus 5.5 (1M)" })).toBeInTheDocument();
    expect(names().slice(0, 4)).toEqual(["Opus 5.5 (1M)", "Fable 5.1", "Sonnet 5", "Haiku 4.5"]);
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

    expect(onChange).toHaveBeenCalledWith({ model: "claude-opus-5-5[1m]", effort: "max" });
  });

  it("calls nothing for what is already checked", async () => {
    const { user, onChange } = picker();

    await user.click(trigger());
    await user.click(await screen.findByRole("menuitemradio", { name: "Opus 5.5 (1M)" }));
    await user.click(screen.getByRole("menuitemradio", { name: "high" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens from the keyboard", async () => {
    const { user } = picker();

    trigger().focus();
    await user.keyboard("{Enter}");

    expect(await screen.findAllByRole("menuitemradio")).toHaveLength(9);
  });

  it("hides the effort for a model that takes none", async () => {
    const { user } = picker({ model: "claude-haiku-4-5-20251001", effort: "high" });

    await user.click(trigger("PRD model: Haiku 4.5"));

    expect(await screen.findByRole("menuitemradio", { name: "Haiku 4.5" })).toBeInTheDocument();
    expect(screen.queryByText("Effort")).not.toBeInTheDocument();
    expect(names()).toHaveLength(4);
  });

  it("keeps the effort when the model changes to one that takes none", async () => {
    const { user, onChange } = picker();

    await user.click(trigger());
    await user.click(await screen.findByRole("menuitemradio", { name: "Haiku 4.5" }));

    expect(onChange).toHaveBeenCalledWith({ model: "claude-haiku-4-5-20251001", effort: "high" });
  });

  it("marks a model the catalog lacks and keeps it checked", async () => {
    const { user } = picker({ model: "claude-opus-5", effort: "high" });
    const button = trigger("PRD model: Opus 5 · high · unavailable");

    expect(button).toHaveTextContent("Opus 5 · high");
    expect(button).toHaveTextContent("unavailable");

    await user.click(button);
    const item = await screen.findByRole("menuitemradio", { name: "Opus 5 · unavailable" });

    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item).toHaveAttribute("data-disabled");
    expect(names().slice(4)).toEqual(["Opus 5 · unavailable", "high · unavailable"]);
  });

  it("marks an effort the model lacks", async () => {
    const catalog = makeModelCatalog({
      models: [makeCatalogModel({ name: "claude-sonnet-5", efforts: ["low", "medium"] })],
    });
    const { user } = picker({ model: "claude-sonnet-5", effort: "high" }, catalog);
    const button = trigger("PRD model: Sonnet 5 · high · unavailable");

    await user.click(button);
    await screen.findByRole("menuitemradio", { name: "Sonnet 5" });

    expect(names()).toEqual(["Sonnet 5", "low", "medium", "high · unavailable"]);
  });

  it("says why there is nothing to offer", async () => {
    const catalog = makeModelCatalog({ models: [], failure: "not_found" });
    const { user } = picker(CHOICE, catalog);

    await user.click(trigger("PRD model: Opus 5.5 (1M) · high · unavailable"));

    expect(
      await screen.findByText(/Claude Code was not found/, { selector: "[role='menuitem']" }),
    ).toBeInTheDocument();
  });

  it("offers nothing and says nothing while the catalog is still to come", async () => {
    const catalog = makeModelCatalog({ models: [], failure: "" });
    const { user } = picker(CHOICE, catalog);

    await user.click(trigger("PRD model: Opus 5.5 (1M) · high · unavailable"));
    await screen.findByRole("menuitemradio", { name: "Opus 5.5 (1M) · unavailable" });

    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    expect(names()).toEqual(["Opus 5.5 (1M) · unavailable", "high · unavailable"]);
  });
});
