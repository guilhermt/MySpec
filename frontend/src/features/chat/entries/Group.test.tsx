import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildConversation, type GroupModel } from "@/features/chat/conversation";
import { Group } from "@/features/chat/entries/Group";
import type { ActionEntry, Entry } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { renderWithStore } from "@/test/render";
import { makeAction, makeEntry } from "@/test/wails-mock";

const START = "2026-09-05T13:48:00Z";

function action(i: number, overrides: Partial<ActionEntry> = {}): Entry {
  return makeEntry("action", {
    turnId: "turn-1",
    action: makeAction({
      toolUseId: `toolu_${i}`,
      tool: "Read",
      target: `src/file${i}.ts`,
      startedAt: new Date(Date.parse(START) + i * 10_000).toISOString(),
      finishedAt: new Date(Date.parse(START) + i * 10_000 + 100).toISOString(),
      ...overrides,
    }),
  });
}

function groupOf(entries: Entry[]): GroupModel {
  const row = buildConversation(entries, "Implementer").stretches[0]?.rows[0];
  if (row?.kind !== "group") {
    throw new Error("not a group");
  }
  return row.group;
}

function renderGroup(entries: Entry[]) {
  return renderWithStore(
    <Group taskId="task-1" stage="step:3" group={groupOf(entries)} waitingToolUseId={null} />,
  );
}

describe("Group", () => {
  it("is one folded line with the count, the summary, the start and the duration in its name", () => {
    renderGroup([action(0), action(1), action(2, { tool: "Grep", target: "useAppStore" })]);

    const name = `3 actions, Read 2 · Searched 1, started ${clockTime(START, Date.now())}, 20s`;
    const group = screen.getByRole("article", { name });
    expect(group).toHaveTextContent("3 actions");
    // The line is the stop of the walk, with the state of the fold and the name of the group.
    const toggle = screen.getByRole("button", { name });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("data-feed-item");
    expect(screen.queryByText("src/file0.ts")).not.toBeInTheDocument();
  });

  it("counts a single action in the singular", () => {
    renderGroup([action(0)]);

    expect(screen.getByRole("button")).toHaveTextContent("1 action");
  });

  it("says what runs while it runs", () => {
    renderGroup([
      action(0),
      action(1, {
        tool: "Bash",
        description: "Run the refill and eviction tests",
        target: "go test ./internal/ratelimit/...",
        status: "running",
        finishedAt: "",
      }),
    ]);

    const group = screen.getByRole("article", {
      name: "2 actions, running: Run the refill and eviction tests",
    });
    expect(group).toHaveTextContent("go test ./internal/ratelimit/...");
    expect(group).not.toHaveTextContent("Read 1");
  });

  it("writes a failure that stays in the error tone", () => {
    renderGroup([action(0, { tool: "Bash", target: "go test ./...", status: "error" })]);

    expect(screen.getByText("· 1 failed")).toHaveClass("text-state-error");
  });

  it("opens into its commands, the last six of more than eight", async () => {
    const { user } = renderGroup(Array.from({ length: 9 }, (_, i) => action(i)));

    await user.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByRole("button", { name: /Show 3 earlier actions/ })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem", { name: /^Read: / })).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: /Show 3 earlier actions/ }));
    expect(screen.getAllByRole("listitem", { name: /^Read: / })).toHaveLength(9);
  });

  it("gives the focus to the first row Show earlier actions reveals", async () => {
    const { user } = renderGroup(Array.from({ length: 9 }, (_, i) => action(i)));
    await user.click(screen.getByRole("button", { expanded: false }));
    screen.getByRole("button", { name: /Show 3 earlier actions/ }).focus();

    await user.keyboard("{Enter}");

    expect(screen.queryByRole("button", { name: /earlier actions/ })).not.toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /^Read: src\/file0\.ts/ })).toHaveFocus();
  });

  it("keeps every command of up to eight", async () => {
    const { user } = renderGroup(Array.from({ length: 8 }, (_, i) => action(i)));

    await user.click(screen.getByRole("button"));

    expect(screen.getAllByRole("listitem", { name: /^Read: / })).toHaveLength(8);
    expect(screen.queryByText(/earlier actions/)).not.toBeInTheDocument();
  });
});
