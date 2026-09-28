import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { type TabItem, Tabs } from "./Tabs";

type Agent = "implementer" | "reviewer" | "notes";

const ITEMS: readonly TabItem<Agent>[] = [
  { id: "implementer", label: "Implementer", accessibleName: "Implementer: working" },
  {
    id: "reviewer",
    label: "Reviewer",
    accessibleName: "Reviewer: waiting for you",
    word: { text: "waits", tone: "wait" },
    tooltip: "Reviewer: waiting for you",
    flash: "wait",
  },
  { id: "notes", label: "Notes", accessibleName: "Notes: idle" },
];

function Subject({
  items = ITEMS,
  onValueChange = () => {},
}: {
  items?: readonly TabItem<Agent>[];
  onValueChange?: (id: Agent) => void;
}) {
  const [value, setValue] = useState<Agent>("implementer");
  return (
    <Tabs
      label="Agents"
      items={items}
      value={value}
      onValueChange={(id) => {
        setValue(id);
        onValueChange(id);
      }}
      controls="conversation"
    />
  );
}

describe("Tabs", () => {
  it("is a tab list with one selected tab that controls the panel", () => {
    renderWithStore(<Subject />);
    screen.getByRole("tablist", { name: "Agents" });
    const implementer = screen.getByRole("tab", { name: "Implementer: working" });
    expect(implementer).toHaveAttribute("aria-selected", "true");
    expect(implementer).toHaveAttribute("aria-controls", "conversation");
    expect(screen.getByRole("tab", { name: "Reviewer: waiting for you" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("is one Tab stop, the chosen tab", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    expect(screen.getByRole("tab", { name: "Implementer: working" })).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("moves and chooses with the arrows, round the ends", async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithStore(<Subject onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    const reviewer = screen.getByRole("tab", { name: "Reviewer: waiting for you" });
    expect(reviewer).toHaveFocus();
    expect(reviewer).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Notes: idle" })).toHaveFocus();
    expect(onValueChange.mock.calls).toEqual([["reviewer"], ["implementer"], ["notes"]]);
  });

  it("chooses on click", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.click(screen.getByRole("tab", { name: "Notes: idle" }));
    expect(screen.getByRole("tab", { name: "Notes: idle" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("says the word only on a tab that is not chosen", async () => {
    const { user } = renderWithStore(<Subject />);
    const reviewer = screen.getByRole("tab", { name: "Reviewer: waiting for you" });
    expect(reviewer).toHaveTextContent("Reviewer· waits");
    await user.click(reviewer);
    expect(reviewer).toHaveTextContent(/^Reviewer$/);
  });

  it("skips a disabled tab and ignores its click", async () => {
    const onValueChange = vi.fn();
    const items: readonly TabItem<Agent>[] = [
      ITEMS[0] as TabItem<Agent>,
      {
        id: "reviewer",
        label: "Reviewer",
        accessibleName: "Reviewer: starts with pass 1",
        disabled: true,
        disabledLabel: "starts with pass 1",
      },
    ];
    const { user } = renderWithStore(<Subject items={items} onValueChange={onValueChange} />);
    const reviewer = screen.getByRole("tab", { name: "Reviewer: starts with pass 1" });
    expect(reviewer).toHaveAttribute("aria-disabled", "true");
    expect(reviewer).toHaveTextContent("Reviewer · starts with pass 1");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Implementer: working" })).toHaveFocus();
    await user.click(reviewer);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("flashes a tab with a new situation", () => {
    renderWithStore(<Subject />);
    const reviewer = screen.getByRole("tab", { name: "Reviewer: waiting for you" });
    expect(reviewer).toHaveClass("situation-flash");
    expect(reviewer).toHaveAttribute("data-flash", "wait");
    expect(screen.getByRole("tab", { name: "Notes: idle" })).not.toHaveClass("situation-flash");
  });

  it("names the tab in its tooltip", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Reviewer: waiting for you");
  });
});
