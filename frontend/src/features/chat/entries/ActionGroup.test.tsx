import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActionGroup } from "@/features/chat/entries/ActionGroup";
import type { ActionEntry, ActionStatus } from "@/lib/wails";
import { renderWithStore } from "@/test/render";

function action(overrides: Partial<ActionEntry> = {}): ActionEntry {
  return {
    toolUseId: "toolu_1",
    tool: "Read",
    label: "Read",
    target: "src/main.tsx",
    status: "done",
    ...overrides,
  };
}

const THREE: ActionEntry[] = [
  action(),
  action({ toolUseId: "toolu_2", tool: "Grep", label: "Searched", target: "useAppStore" }),
  action({ toolUseId: "toolu_3", tool: "Bash", label: "Ran", target: "task check" }),
];

describe("ActionGroup", () => {
  it("stays out of the way when there is nothing to show", () => {
    const { container } = renderWithStore(<ActionGroup actions={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("counts the actions while it is folded", () => {
    renderWithStore(<ActionGroup actions={THREE} />);

    expect(screen.getByRole("button", { name: /3 actions/ })).toBeInTheDocument();
    expect(screen.queryByText("Searched")).not.toBeInTheDocument();
  });

  it("counts a single action in the singular", () => {
    renderWithStore(<ActionGroup actions={[action()]} />);

    expect(screen.getByRole("button", { name: /1 action/ })).toBeInTheDocument();
  });

  it("names what is running instead of counting", () => {
    renderWithStore(
      <ActionGroup
        actions={[
          action(),
          action({
            toolUseId: "toolu_2",
            label: "Running",
            target: "go test ./...",
            status: "running",
          }),
        ]}
      />,
    );

    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("Running");
    expect(trigger).toHaveTextContent("go test ./...");
    expect(trigger).not.toHaveTextContent("2 actions");
  });

  it("lists every action once it is unfolded", async () => {
    const { user } = renderWithStore(<ActionGroup actions={THREE} />);

    await user.click(screen.getByRole("button", { name: /3 actions/ }));

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Read");
    expect(items[0]).toHaveTextContent("src/main.tsx");
    expect(items[2]).toHaveTextContent("task check");
    expect(screen.getByTitle("useAppStore")).toBeInTheDocument();
  });

  it.each([
    ["error", "lucide-triangle-alert"],
    ["interrupted", "lucide-ban"],
    ["done", "lucide-check"],
  ] as const)("sums the group up as %s", (status: ActionStatus, icon) => {
    const { container } = renderWithStore(
      <ActionGroup actions={[action(), action({ toolUseId: "toolu_2", status })]} />,
    );

    expect(container.querySelector(`.${icon}`)).not.toBeNull();
  });
});
