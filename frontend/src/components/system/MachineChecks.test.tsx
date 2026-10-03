import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { MachineChecks, type MachineItemView } from "./MachineChecks";

const ITEMS: MachineItemView[] = [
  {
    id: "gh",
    title: "GitHub CLI isn't signed in",
    text: "Sign in to read pull requests.",
    command: "gh auth login",
  },
  { id: "claude", title: "Claude Code isn't installed", text: "Install it first.", command: "" },
];

describe("MachineChecks", () => {
  it("lists each item with its title and text", () => {
    renderWithStore(<MachineChecks items={ITEMS} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Claude Code isn't installed")).toBeInTheDocument();
    expect(screen.getByText("Install it first.")).toBeInTheDocument();
  });

  it("gives a command a copy button, and an item without one nothing", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const { user } = renderWithStore(<MachineChecks items={ITEMS} />);
    const [first, second] = screen.getAllByRole("listitem");
    expect(second && within(second).queryByRole("button")).not.toBeInTheDocument();
    expect(first && within(first).getByText("gh auth login")).toHaveClass("font-mono");
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Copy gh auth login" }));
    expect(writeText).toHaveBeenCalledWith("gh auth login");
  });
});
