import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api, type PromptListing } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makePromptListings, makeState } from "@/test/wails-mock";
import { PromptsPage } from "./PromptsPage";

function page(listings: PromptListing[] = makePromptListings()) {
  vi.mocked(api.listPrompts).mockResolvedValue(listings);
  return renderWithStore(<PromptsPage />, {
    state: makeState(),
    ui: { location: { kind: "settings", section: "prompts" } },
  });
}

const rows = () => within(screen.getByRole("list", { name: "Prompts" })).getAllByRole("listitem");

describe("PromptsPage", () => {
  it("is the page Prompts, with its sentence and the nine prompts in workflow order", async () => {
    page();

    expect(screen.getByRole("heading", { level: 2, name: "Prompts" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "The instructions each session starts with. A prompt you never edit follows the default of every new version of MySpec.",
      ),
    ).toBeInTheDocument();
    expect(rows().map((row) => within(row).getByRole("link").textContent?.slice(0, 8))).toEqual([
      "PRDOpens",
      "Tech spe",
      "PlanOpen",
      "One-Shot",
      "Step rev",
      "CommitSe",
      "PROpens ",
      "PR revie",
      "Discussi",
    ]);
    expect(within(rows()[0] as HTMLElement).getByRole("link")).toHaveTextContent(
      "Opens the PRD session of a task.",
    );
  });

  it("reads the list when it opens, with a shimmering bar in each row meanwhile", async () => {
    vi.mocked(api.listPrompts).mockReturnValue(new Promise(() => {}));
    renderWithStore(<PromptsPage />, { state: makeState() });

    expect(api.listPrompts).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Default")).not.toBeInTheDocument();
    expect(rows()).toHaveLength(9);
  });

  it("says Default for a prompt that was never edited", async () => {
    page();

    expect(await screen.findAllByText("Default")).toHaveLength(9);
  });

  it("says when an edited prompt was edited, with the whole time in the tooltip", async () => {
    const edited = new Date(2020, 8, 20, 9, 14).toISOString();
    const listings = makePromptListings().map((listing) =>
      listing.stage === "plan" ? { ...listing, modified: true, editedAt: edited } : listing,
    );
    const { user } = page(listings);

    const label = await screen.findByText("Edited Sep 20, 2020");
    expect(screen.getAllByText("Default")).toHaveLength(8);
    expect(label.closest("a")).toHaveTextContent("Plan");

    await user.hover(label);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Sunday, September 20, 2020, 09:14",
    );
  });

  it("opens the prompt of the row clicked", async () => {
    const { user } = page();

    await user.click(within(rows()[5] as HTMLElement).getByRole("link"));

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "commit" });
  });

  it("opens a prompt with Enter", async () => {
    const { user } = page();
    within(rows()[0] as HTMLElement)
      .getByRole("link")
      .focus();

    await user.keyboard("{Enter}");

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "prd" });
  });

  it("leaves the column empty and says why when the dates can't be read, and every prompt still opens", async () => {
    vi.mocked(api.listPrompts).mockRejectedValue(new Error("the store is busy"));
    const { user } = renderWithStore(<PromptsPage />, { state: makeState() });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't read which prompts are edited: the store is busy");
    expect(screen.queryByText("Default")).not.toBeInTheDocument();

    await user.click(within(rows()[1] as HTMLElement).getByRole("link"));

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "tech_spec" });
  });

  it("reads the list again with Try again", async () => {
    vi.mocked(api.listPrompts).mockRejectedValueOnce(new Error("the store is busy"));
    const { user } = page();

    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(api.listPrompts).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(await screen.findAllByText("Default")).toHaveLength(9);
  });
});
