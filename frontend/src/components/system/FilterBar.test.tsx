import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { FilterBar, FilterChip, type FilterGroup, FilterMenu } from "./FilterBar";
import { SearchInput } from "./SearchInput";

const GROUPS: FilterGroup[] = [
  {
    label: "Repository",
    items: [
      { value: "r1", label: "acme/api", checked: true },
      { value: "r2", label: "acme/web", checked: false },
    ],
  },
  { label: "Status", items: [{ value: "ready", label: "Ready", checked: false }] },
];

describe("FilterBar", () => {
  it("is the one search landmark, named, around a search box that declares none", () => {
    renderWithStore(
      <FilterBar label="Filter the cards">
        <SearchInput
          label="Search cards"
          value=""
          onValueChange={() => {}}
          placeholder="Search cards"
          landmark={false}
        />
      </FilterBar>,
    );
    const landmarks = screen.getAllByRole("search");
    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]).toHaveAccessibleName("Filter the cards");
    expect(within(landmarks[0] as HTMLElement).getByRole("searchbox")).toBeInTheDocument();
  });
});

describe("FilterChip", () => {
  it("removes with its × named by the filter", async () => {
    const onRemove = vi.fn();
    const { user } = renderWithStore(
      <FilterChip
        model={{ label: "acme/api", removeLabel: "Remove the filter acme/api", orphan: null }}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText("acme/api")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove the filter acme/api" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("marks a filter that matches nothing anymore with the blocked glyph and says why", async () => {
    const { user } = renderWithStore(
      <FilterChip
        model={{
          label: "acme/old",
          removeLabel: "Remove the filter acme/old",
          orphan: "acme/old isn't a repository of this board anymore.",
        }}
        onRemove={() => {}}
      />,
    );
    const chip = screen.getByRole("button", { name: "acme/old" });
    expect(chip.querySelector('[data-state="blocked"]')).not.toBeNull();
    await user.hover(chip);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "acme/old isn't a repository of this board anymore.",
    );
  });
});

describe("FilterMenu", () => {
  async function open(onPick = vi.fn()) {
    const rendered = renderWithStore(
      <FilterMenu tooltip="Repository, assignee, status" groups={GROUPS} onPick={onPick} />,
    );
    await rendered.user.click(screen.getByRole("button", { name: "Filter" }));
    await screen.findByRole("menu");
    return { ...rendered, onPick };
  }

  it("opens a menu with a group for each filter", async () => {
    await open();
    expect(screen.getByRole("group", { name: "Repository" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Status" })).toBeInTheDocument();
  });

  it("shows the checked item of a group", async () => {
    await open();
    expect(screen.getByRole("menuitemcheckbox", { name: "acme/api" })).toBeChecked();
    expect(screen.getByRole("menuitemcheckbox", { name: "acme/web" })).not.toBeChecked();
  });

  it("picks an item and closes the menu", async () => {
    const { user, onPick } = await open();
    await user.click(screen.getByRole("menuitemcheckbox", { name: "acme/web" }));
    expect(onPick).toHaveBeenCalledWith("Repository", "r2", true);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("unchecks the checked item on a click", async () => {
    const { user, onPick } = await open();
    await user.click(screen.getByRole("menuitemcheckbox", { name: "acme/api" }));
    expect(onPick).toHaveBeenCalledWith("Repository", "r1", false);
  });

  it("says in the tooltip what it filters by", async () => {
    const { user } = await open();
    await user.keyboard("{Escape}");
    await user.hover(screen.getByRole("button", { name: "Filter" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Repository, assignee, status");
  });

  it("cycles a three-way filter after the other groups, keeping the menu open", async () => {
    const onCycle = vi.fn();
    const { user } = renderWithStore(
      <FilterMenu
        tooltip="Board, repository, author, label"
        groups={GROUPS}
        onPick={vi.fn()}
        cycles={[
          {
            label: "Label",
            note: "click to hide, again to keep only",
            items: [{ value: "deps", label: "dependencies", state: "hidden" }],
          },
        ]}
        onCycle={onCycle}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Filter" }));
    await screen.findByRole("menu");
    expect(screen.getByRole("group", { name: /Label/ })).toHaveTextContent(
      "click to hide, again to keep only",
    );
    await user.click(
      screen.getByRole("menuitem", { name: "dependencies: hidden. Click to cycle." }),
    );
    expect(onCycle).toHaveBeenCalledWith("Label", "deps", "only");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
