import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import {
  DaySectionHeader,
  type DaySectionHeaderProps,
  ListSectionHeader,
  type ListSectionHeaderProps,
} from "./ListSectionHeader";

function header(props: Partial<ListSectionHeaderProps> = {}) {
  const onToggle = vi.fn();
  const onFocus = vi.fn();
  const rendered = renderWithStore(
    <ListSectionHeader
      id="backlog"
      name="Backlog"
      count={27}
      collapsed={false}
      empty={false}
      tooltip={null}
      label="Backlog, 27 cards"
      tabStop={false}
      onToggle={onToggle}
      onFocus={onFocus}
      {...props}
    />,
  );
  return { ...rendered, onToggle, onFocus };
}

describe("ListSectionHeader", () => {
  it("is a treeitem of level 1 named by its label, expanded", () => {
    header();
    const item = screen.getByRole("treeitem", { name: "Backlog, 27 cards" });
    expect(item).toHaveAttribute("aria-level", "1");
    expect(item).toHaveAttribute("aria-expanded", "true");
    expect(item).toHaveAttribute("data-section-id", "backlog");
  });

  it("writes the name and the count only, and leaves a final status to its tooltip and its name", () => {
    header({
      name: "Done",
      count: 12,
      tooltip: "A final status: folded when the board opens",
      label: "Done, 12 cards, final status",
    });
    expect(
      screen.getByRole("treeitem", { name: "Done, 12 cards, final status" }),
    ).toHaveTextContent(/^Done12$/);
  });

  it("is collapsed when the section is", () => {
    header({ collapsed: true });
    expect(screen.getByRole("treeitem")).toHaveAttribute("aria-expanded", "false");
  });

  it("holds the tab stop only when it is the stop", () => {
    const { unmount } = header({ tabStop: true });
    expect(screen.getByRole("treeitem")).toHaveAttribute("tabindex", "0");
    unmount();
    header({ tabStop: false });
    expect(screen.getByRole("treeitem")).toHaveAttribute("tabindex", "-1");
  });

  it("toggles on click and reports the focus", async () => {
    const { user, onToggle, onFocus } = header();
    await user.click(screen.getByRole("treeitem"));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onFocus).toHaveBeenCalled();
  });

  it("has neither expansion nor action when empty", async () => {
    const { user, onToggle } = header({ empty: true, count: 0, label: "Ready, 0 cards" });
    const item = screen.getByRole("treeitem", { name: "Ready, 0 cards" });
    expect(item).not.toHaveAttribute("aria-expanded");
    await user.click(item);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("shows the count", () => {
    header();
    expect(screen.getByText("27")).toBeInTheDocument();
  });
});

describe("DaySectionHeader", () => {
  function day(props: Partial<DaySectionHeaderProps> = {}) {
    const onFocus = vi.fn();
    const rendered = renderWithStore(
      <DaySectionHeader
        id="2026-09-22"
        name="Monday, Sep 22"
        count={5}
        label="Archived on Monday, Sep 22: 5"
        tabStop={false}
        onFocus={onFocus}
        {...props}
      />,
    );
    return { ...rendered, onFocus, item: screen.getByRole("treeitem") };
  }

  it("is a treeitem of level 1, always open, named by its label", () => {
    const { item } = day();
    expect(item).toHaveAttribute("aria-level", "1");
    expect(item).toHaveAttribute("aria-expanded", "true");
    expect(item).toHaveAccessibleName("Archived on Monday, Sep 22: 5");
    expect(item).toHaveAttribute("data-section-id", "2026-09-22");
  });

  it("has no chevron and does not collapse on click", async () => {
    const { user, item } = day();
    expect(item.querySelector("svg")).toBeNull();
    await user.click(item);
    expect(item).toHaveAttribute("aria-expanded", "true");
  });

  it("says its name and its count", () => {
    day();
    expect(screen.getByText("Monday, Sep 22")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("is the tab stop only when told, and tells its focus", () => {
    const { item, onFocus } = day({ tabStop: true });
    expect(item).toHaveAttribute("tabindex", "0");
    item.focus();
    expect(onFocus).toHaveBeenCalled();
  });
});
