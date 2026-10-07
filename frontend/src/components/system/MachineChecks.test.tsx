import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { MachineChecks, type MachineItemView } from "./MachineChecks";

const ITEMS: MachineItemView[] = [
  {
    id: "gh_login",
    result: "missing",
    title: "GitHub CLI isn't signed in",
    text: "Sign in to read pull requests.",
    command: "gh auth login",
    detail: "",
  },
  {
    id: "claude_found",
    result: "missing",
    title: "Claude Code isn't installed",
    text: "Install it first.",
    command: "",
    detail: "",
  },
];

function view(result: MachineItemView["result"], overrides: Partial<MachineItemView> = {}) {
  return { id: "x", result, title: "Title", text: "", command: "", detail: "", ...overrides };
}

describe("MachineChecks", () => {
  it("lists each item with its title and text", () => {
    renderWithStore(<MachineChecks items={ITEMS} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Claude Code isn't installed")).toBeInTheDocument();
    expect(screen.getByText("Install it first.")).toBeInTheDocument();
  });

  it.each([
    ["ok", "OK: ", undefined],
    ["missing", "Missing: ", "blocked"],
    ["unchecked", "Not checked: ", "todo"],
  ] as const)(
    "draws the glyph of a %s item and says the result to a screen reader",
    (result, hidden, state) => {
      const { container } = renderWithStore(<MachineChecks items={[view(result)]} />);
      expect(screen.getByText(hidden.trim())).toHaveClass("sr-only");
      if (state === undefined) {
        expect(container.querySelector("svg")).toBeInTheDocument();
        expect(container.querySelector("[data-state]")).not.toBeInTheDocument();
      } else {
        expect(container.querySelector(`[data-state="${state}"]`)).toBeInTheDocument();
      }
    },
  );

  it("leaves no paragraph for an empty text or detail", () => {
    const { container } = renderWithStore(<MachineChecks items={[view("ok")]} />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("shows the detail in mono under the text", () => {
    renderWithStore(
      <MachineChecks items={[view("unchecked", { text: "The check failed.", detail: "boom" })]} />,
    );
    expect(screen.getByText("boom")).toHaveClass("font-mono");
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
