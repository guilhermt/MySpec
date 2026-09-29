import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ActionNode } from "@/features/chat/conversation";
import { SubagentRow } from "@/features/chat/entries/SubagentRow";
import type { ActionEntry } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeAction, makeEntry } from "@/test/wails-mock";

function node(action: Partial<ActionEntry>, children: ActionNode[] = []): ActionNode {
  const made = makeAction(action);
  return { entry: makeEntry("action", { action: made }), action: made, children };
}

function reads(count: number): ActionNode[] {
  return Array.from({ length: count }, (_, i) =>
    node({ toolUseId: `toolu_c${i}`, tool: "Read", target: `src/file${i}.ts` }),
  );
}

function renderSubagent(subagent: ActionNode) {
  return renderWithStore(
    <ul>
      <SubagentRow taskId="task-1" stage="step:3" node={subagent} waitingToolUseId={null} />
    </ul>,
  );
}

describe("SubagentRow", () => {
  it("is folded, with what it was given and the summary of its actions", () => {
    renderSubagent(
      node(
        { toolUseId: "toolu_a", tool: "Agent", description: "Check how others evict idle entries" },
        reads(3),
      ),
    );

    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("Delegated · Check how others evict idle entries");
    expect(toggle).toHaveTextContent("3 actions · Read 3");
    expect(screen.queryByText("src/file0.ts")).not.toBeInTheDocument();
  });

  it("names the kind of subagent without a description, and only Delegated without both", () => {
    const { unmount } = renderSubagent(node({ tool: "Agent", target: "Explore" }));
    expect(screen.getByText("Delegated · Explore")).toBeInTheDocument();
    unmount();

    renderSubagent(node({ tool: "Task", target: "" }));
    expect(screen.getByText("Delegated")).toBeInTheDocument();
  });

  it("opens into its last six actions and its report", async () => {
    const { user } = renderSubagent(
      node(
        { toolUseId: "toolu_a", tool: "Agent", outputLines: 1, outputTail: "Two packages sweep." },
        reads(10),
      ),
    );

    await user.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByRole("button", { name: /Show 4 earlier actions/ })).toBeInTheDocument();
    expect(screen.queryByText("src/file3.ts")).not.toBeInTheDocument();
    expect(screen.getByText("src/file4.ts")).toBeInTheDocument();
    expect(screen.getByText("Two packages sweep.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Show 4 earlier actions/ }));
    expect(screen.getByText("src/file0.ts")).toBeInTheDocument();
  });
});
