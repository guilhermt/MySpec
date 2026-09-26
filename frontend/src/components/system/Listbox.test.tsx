import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Listbox, type ListboxProps } from "./Listbox";

const ITEMS = [
  { value: "main", label: "main", sub: "default" },
  { value: "develop", label: "develop" },
  { value: "release", label: "release" },
];

function Subject(props: Partial<ListboxProps>) {
  const [value, setValue] = useState<string | null>("main");
  return (
    <Listbox
      label="Base branch"
      value={value}
      items={ITEMS}
      onValueChange={setValue}
      searchLabel="Search branches"
      emptyText="No branch matches"
      {...props}
    />
  );
}

async function open(props: Partial<ListboxProps> = {}, name = "Base branch: main") {
  const rendered = renderWithStore(<Subject {...props} />);
  await rendered.user.click(screen.getByRole("combobox", { name }));
  await screen.findByRole("listbox");
  return rendered;
}

describe("Listbox", () => {
  it("opens from its trigger", async () => {
    await open();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("filters by the search", async () => {
    const { user } = await open();
    await user.type(screen.getByRole("combobox", { name: "Search branches" }), "dev");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["develop"]);
  });

  it("says so when the search finds nothing", async () => {
    const { user } = await open();
    await user.type(screen.getByRole("combobox", { name: "Search branches" }), "zzz");
    expect(screen.getByText("No branch matches")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("selects the chosen option", async () => {
    await open();
    expect(screen.getByRole("option", { name: "main default" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: "develop" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("chooses with ArrowDown and Enter", async () => {
    const onValueChange = vi.fn();
    const { user } = await open({ value: null, onValueChange }, "Base branch:");
    await user.click(screen.getByRole("combobox", { name: "Search branches" }));
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("develop");
  });

  it("closes on Escape and gives the focus back to the trigger", async () => {
    const { user } = await open();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Base branch: main" })).toHaveFocus();
  });

  it("takes the focus", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    expect(screen.getByRole("combobox", { name: "Base branch: main" })).toHaveFocus();
  });
});
