import { screen, within } from "@testing-library/react";
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

  it("does not open while disabled and tells the reason", async () => {
    const { user } = renderWithStore(<Subject disabled disabledReason="The session is running" />);
    const trigger = screen.getByRole("combobox", { name: "Base branch: main" });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAccessibleDescription("The session is running");
    await user.tab();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shimmers the saved choice while the catalog is read", () => {
    renderWithStore(<Subject loading />);
    const trigger = screen.getByRole("combobox", { name: "Base branch: main" });
    expect(trigger).toHaveAttribute("aria-busy", "true");
    expect(within(trigger).getByText("main")).toBeInTheDocument();
  });

  it("stands a message in for the list, as a status or as an alert with Try again", async () => {
    const onRetry = vi.fn();
    const { user } = renderWithStore(
      <Subject message={{ text: "Could not list the branches", tone: "error", onRetry }} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Base branch: main" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not list the branches");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("says a neutral message as a status", async () => {
    const { user } = renderWithStore(<Subject message={{ text: "Reading the branches…" }} />);
    await user.click(screen.getByRole("combobox", { name: "Base branch: main" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Reading the branches…");
  });

  it("marks a choice no longer offered without letting it be chosen", async () => {
    const onValueChange = vi.fn();
    const { user } = await open({
      items: [...ITEMS, { value: "old", label: "old", unavailable: true }],
      onValueChange,
    });
    const old = screen.getByRole("option", { name: "◇ old · unavailable" });
    expect(old).toHaveAttribute("aria-disabled", "true");
    await user.click(old);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps a saved choice that is no longer offered, marked", () => {
    renderWithStore(
      <Subject items={[...ITEMS, { value: "old", label: "old", unavailable: true }]} value="old" />,
    );
    expect(screen.getByRole("combobox", { name: "Base branch: old" })).toHaveTextContent("◇ old");
  });
});
