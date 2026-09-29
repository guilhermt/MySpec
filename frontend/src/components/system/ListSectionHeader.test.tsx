import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { ListSectionHeader, type ListSectionHeaderProps } from "./ListSectionHeader";

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
      final={false}
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
