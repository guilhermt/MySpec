import { screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import {
  CARDS_SHOWN,
  type DependencyOption,
  DependencyPicker,
  type DependencyPickerProps,
} from "./DependencyPicker";

const DRAFTS: DependencyOption[] = [
  { value: "d1", label: "Overage on the monthly invoice", sub: "acme/billing" },
  { value: "d2", label: "Usage meter in the dashboard", sub: "acme/web" },
];

const CARDS: DependencyOption[] = [
  { value: "acme/billing#474", label: "#474 Usage alerts at 80% of the plan", sub: "" },
  { value: "acme/billing#480", label: "#480 Invoice in PDF", sub: "" },
];

/** Subject keeps the chosen values as the store would, through onToggle. */
function Subject({
  onToggle,
  ...props
}: Partial<DependencyPickerProps> & { onToggle?: (value: string) => Promise<string | null> }) {
  const [chosen, setChosen] = useState<readonly string[]>(props.chosen ?? []);
  return (
    <DependencyPicker
      recorded={[]}
      drafts={DRAFTS}
      cards={CARDS}
      onClose={() => {}}
      {...props}
      chosen={chosen}
      onToggle={async (value) => {
        const refusal = onToggle === undefined ? null : await onToggle(value);
        if (refusal === null) {
          setChosen((now) =>
            now.includes(value) ? now.filter((v) => v !== value) : [...now, value],
          );
        }
        return refusal;
      }}
    />
  );
}

function search() {
  return screen.getByRole("combobox", { name: "Search drafts and cards" });
}

function names(): string[] {
  return screen.getAllByRole("option").map((option) => option.textContent ?? "");
}

describe("DependencyPicker", () => {
  it("is the listbox Depend on, with the focus in its search", () => {
    renderWithStore(<Subject />);
    const listbox = screen.getByRole("listbox", { name: "Depend on" });
    expect(search()).toHaveFocus();
    expect(search()).toHaveAttribute("placeholder", "#474 or a title");
    expect(search()).toHaveAttribute("aria-controls", listbox.id);
  });

  it("shows the drafts, then the cards of the board", () => {
    renderWithStore(<Subject />);
    expect(screen.getAllByRole("group")).toEqual([
      screen.getByRole("group", { name: "Drafts of this discussion" }),
      screen.getByRole("group", { name: "Cards of the board" }),
    ]);
    expect(
      within(screen.getByRole("group", { name: "Drafts of this discussion" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Overage on the monthly invoice acme/billing",
      "Usage meter in the dashboard acme/web",
    ]);
    expect(
      within(screen.getByRole("group", { name: "Cards of the board" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["#474 Usage alerts at 80% of the plan", "#480 Invoice in PDF"]);
  });

  it("filters by the title", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.type(search(), "usage");
    expect(names()).toEqual([
      "Usage meter in the dashboard acme/web",
      "#474 Usage alerts at 80% of the plan",
    ]);
  });

  it("filters by the number of a card", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.type(search(), "#480");
    expect(names()).toEqual(["#480 Invoice in PDF"]);
    expect(
      screen.queryByRole("group", { name: "Drafts of this discussion" }),
    ).not.toBeInTheDocument();
  });

  it("shows at most twenty cards", () => {
    const cards = Array.from({ length: 30 }, (_, n) => ({
      value: `acme/billing#${n}`,
      label: `#${n} Card ${n}`,
      sub: "",
    }));
    renderWithStore(<Subject cards={cards} />);
    expect(
      within(screen.getByRole("group", { name: "Cards of the board" })).getAllByRole("option"),
    ).toHaveLength(CARDS_SHOWN);
  });

  it("says so when nothing matches", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.type(search(), "zzz");
    expect(screen.getByText("No card matches.")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("offers an issue typed as owner/name#N at the end", async () => {
    const onToggle = vi.fn(async () => null);
    const { user } = renderWithStore(<Subject onToggle={onToggle} />);
    await user.type(search(), "acme/api#99");
    expect(names()).toEqual(["Depend on acme/api#99"]);
    expect(screen.queryByText("No card matches.")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(onToggle).toHaveBeenCalledWith("acme/api#99");
  });

  it("does not offer a typed issue that is already a card", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.type(search(), "acme/billing#474");
    expect(names()).toEqual(["#474 Usage alerts at 80% of the plan"]);
  });

  it("marks the chosen with aria-selected", () => {
    renderWithStore(<Subject chosen={["acme/billing#474"]} />);
    expect(
      screen.getByRole("option", { name: "#474 Usage alerts at 80% of the plan" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "#480 Invoice in PDF" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("chooses with a click and takes out with another", async () => {
    const onToggle = vi.fn(async () => null);
    const { user } = renderWithStore(<Subject onToggle={onToggle} />);
    const option = screen.getByRole("option", { name: "#480 Invoice in PDF" });
    await user.click(option);
    expect(option).toHaveAttribute("aria-selected", "true");
    await user.click(option);
    expect(option).toHaveAttribute("aria-selected", "false");
    expect(onToggle.mock.calls).toEqual([["acme/billing#480"], ["acme/billing#480"]]);
    expect(search()).toHaveFocus();
  });

  it("does not take out a dependency recorded on GitHub", async () => {
    const onToggle = vi.fn(async () => null);
    const { user } = renderWithStore(
      <Subject chosen={["acme/billing#474"]} recorded={["acme/billing#474"]} onToggle={onToggle} />,
    );
    const option = screen.getByRole("option", { name: "#474 Usage alerts at 80% of the plan" });
    expect(option).toHaveAttribute("aria-disabled", "true");
    await user.click(option);
    expect(onToggle).not.toHaveBeenCalled();
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  it("moves the active option with the arrows and chooses it with Enter", async () => {
    const onToggle = vi.fn(async () => null);
    const { user } = renderWithStore(<Subject onToggle={onToggle} />);
    expect(search()).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    const active = screen.getByRole("option", { name: "#474 Usage alerts at 80% of the plan" });
    expect(search()).toHaveAttribute("aria-activedescendant", active.id);
    await user.keyboard("{ArrowUp}{Enter}");
    expect(onToggle).toHaveBeenCalledWith("d2");
  });

  it("makes the first match active as the search narrows", async () => {
    const onToggle = vi.fn(async () => null);
    const { user } = renderWithStore(<Subject onToggle={onToggle} />);
    await user.type(search(), "invoice{Enter}");
    expect(onToggle).toHaveBeenCalledWith("d1");
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const { user } = renderWithStore(<Subject onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows a refusal under the search until a choice goes through", async () => {
    const onToggle = vi.fn(async (value: string) =>
      value === "d1" ? "A draft can't depend on itself." : null,
    );
    const { user } = renderWithStore(<Subject onToggle={onToggle} />);
    await user.click(
      screen.getByRole("option", { name: "Overage on the monthly invoice acme/billing" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("A draft can't depend on itself.");
    expect(search()).toHaveAccessibleDescription("A draft can't depend on itself.");
    await user.click(screen.getByRole("option", { name: "#480 Invoice in PDF" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
