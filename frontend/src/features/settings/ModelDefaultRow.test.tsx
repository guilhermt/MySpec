import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ModelChoice } from "@/lib/models";
import { api, type ModelCatalog } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeModelCatalog, makeState } from "@/test/wails-mock";
import { ModelDefaultRow, type ModelDefaultRowProps } from "./ModelDefaultRow";

const FABLE: ModelChoice = { model: "claude-fable-5-1", effort: "high" };
const OPUS: ModelChoice = { model: "claude-opus-5-5[1m]", effort: "medium" };

function row(
  props: Partial<ModelDefaultRowProps> = {},
  catalog: ModelCatalog = makeModelCatalog(),
) {
  return renderWithStore(
    <ul>
      <ModelDefaultRow stage="pr" note="" choice={OPUS} factory={OPUS} {...props} />
    </ul>,
    { state: makeState({ modelCatalog: catalog }) },
  );
}

const chip = (name: string) => screen.getByRole("button", { name });

describe("ModelDefaultRow", () => {
  it("names the stage and its note, and its chip says it is the factory default", async () => {
    const { user } = row({ note: "Where a new discussion starts" });

    expect(screen.getByText("PR")).toBeInTheDocument();
    expect(screen.getByText("Where a new discussion starts")).toBeInTheDocument();
    const factory = chip("PR: Opus 5.5 (1M) · medium, the factory default");
    expect(factory).toHaveTextContent("Opus 5.5 (1M) · medium");
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("The factory default");
  });

  it("says what a changed choice sets aside, as its own choice", async () => {
    const { user } = row({ choice: { model: "claude-opus-5-5[1m]", effort: "xhigh" } });

    const changed = chip(
      "PR: Opus 5.5 (1M) · xhigh, changed from the factory default Opus 5.5 (1M) · medium",
    );
    expect(changed).toHaveAccessibleDescription("Factory default: Opus 5.5 (1M) · medium");
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Factory default: Opus 5.5 (1M) · medium",
    );
  });

  it("marks the factory choice in the menu, and says where the models come from", async () => {
    const { user } = row({ choice: FABLE });

    await user.click(
      chip("PR: Fable 5.1 · high, changed from the factory default Opus 5.5 (1M) · medium"),
    );

    const factory = await screen.findByRole("menuitemradio", { name: /^Opus 5.5 \(1M\)/ });
    expect(factory).toHaveTextContent("factory");
    expect(screen.getByRole("menuitemradio", { name: /^Fable 5.1/ })).not.toHaveTextContent(
      "factory",
    );
    expect(screen.getByText("Effort · Fable 5.1")).toBeInTheDocument();
    expect(
      screen.getByText("From the Claude Code installed here, read when MySpec opened."),
    ).toBeInTheDocument();
  });

  it("saves the choice at once, the chip saving meanwhile", async () => {
    let finish = () => {};
    vi.mocked(api.setModelDefault).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = row();

    await user.click(chip("PR: Opus 5.5 (1M) · medium, the factory default"));
    await user.click(await screen.findByRole("menuitemradio", { name: "low" }));

    expect(api.setModelDefault).toHaveBeenCalledWith("pr", "claude-opus-5-5[1m]", "low");
    const saving = screen.getByRole("button", { name: /^PR/ });
    expect(saving).toHaveAttribute("aria-busy", "true");
    expect(saving).toHaveTextContent("Saving…");

    finish();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^PR/ })).not.toHaveAttribute("aria-busy"),
    );
  });

  it("keeps the saved choice when saving fails, says why under the row, and Try again saves it again", async () => {
    vi.mocked(api.setModelDefault).mockRejectedValueOnce(new Error("the disk is full"));
    const { user } = row();

    await user.click(chip("PR: Opus 5.5 (1M) · medium, the factory default"));
    await user.click(await screen.findByRole("menuitemradio", { name: "low" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't save Opus 5.5 (1M) · low: the disk is full");
    expect(chip("PR: Opus 5.5 (1M) · medium, the factory default")).toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(api.setModelDefault).toHaveBeenLastCalledWith("pr", "claude-opus-5-5[1m]", "low");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("marks a choice the installed Claude Code no longer lists, and keeps it", () => {
    row({ choice: { model: "claude-opus-4-1", effort: "high" } });

    const unavailable = chip(
      "PR: Opus 4.1 · high, unavailable, changed from the factory default Opus 5.5 (1M) · medium",
    );
    expect(unavailable).toHaveTextContent("Opus 4.1 · high · unavailable");
  });

  it("doesn't open its menu while the catalog is read, and says so", async () => {
    const { user } = row({}, makeModelCatalog({ models: [], failure: "" }));

    const reading = chip("PR: Opus 5.5 (1M) · medium, the factory default");
    expect(reading).toHaveAttribute("aria-busy", "true");
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Reading the models of Claude Code · the menu opens when it ends",
    );

    await user.click(reading);

    expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
  });
});
