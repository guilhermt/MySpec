import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubagentConversation } from "@/features/chat/SubagentConversation";
import { type ActionEntry, api, type Entry } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import type { TranscriptState } from "@/store/transcript";
import { renderWithStore, resetAppStore } from "@/test/render";
import {
  makeAction,
  makeEntry,
  makeRunningTask,
  makeState,
  makeTask,
  resetWailsMock,
} from "@/test/wails-mock";

const CALL = "toolu_agent";
const STAGE = "step:1";

beforeEach(() => {
  resetWailsMock();
  resetAppStore();
});

function call(overrides: Partial<ActionEntry> = {}): Entry {
  return makeEntry("action", {
    turnId: "turn-1",
    action: makeAction({
      toolUseId: CALL,
      tool: "Agent",
      description: "Survey the repository",
      prompt: "Read the sessions and report.",
      status: "running",
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      ...overrides,
    }),
  });
}

function said(text: string): Entry {
  const entry = makeEntry("assistant", { turnId: "turn-2" });
  return {
    ...entry,
    assistant: entry.assistant && { ...entry.assistant, text, parentToolUseId: CALL },
  };
}

function reads(target: string, status = "done"): Entry {
  return makeEntry("action", {
    turnId: "turn-2",
    action: makeAction({ toolUseId: `toolu_${target}`, parentToolUseId: CALL, target, status }),
  });
}

function show(entries: Entry[], options: { running?: boolean; sessionOpen?: boolean } = {}) {
  const transcript: TranscriptState = {
    status: "ready",
    error: "",
    entries,
    pending: [],
    buffered: [],
  };
  const task = makeTask({
    running: options.running
      ? [{ stage: STAGE, tasks: [makeRunningTask({ toolUseId: CALL, taskId: "task_a1" })] }]
      : [],
  });
  return renderWithStore(
    <SubagentConversation
      itemId="task-1"
      stage={STAGE}
      toolUseId={CALL}
      voice="Implementer"
      sessionOpen={options.sessionOpen ?? true}
    />,
    {
      state: makeState({ tasks: [task] }),
      ui: { transcripts: { [`task-1|${STAGE}`]: transcript } },
    },
  );
}

describe("SubagentConversation", () => {
  it("reads the task it received, what it said and what it did, live", async () => {
    show(
      [call(), said("Looking at the sessions."), reads("internal/session/service.go", "running")],
      {
        running: true,
      },
    );

    expect(
      await screen.findByRole("region", {
        name: "Survey the repository, a subagent's conversation",
      }),
    ).toHaveFocus();
    expect(
      await screen.findByRole("article", { name: "Task from the implementer" }),
    ).toHaveTextContent("Read the sessions and report.");
    expect(screen.getByText("Looking at the sessions.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 action.*running/ })).toBeInTheDocument();
    // It runs: no line of an end.
    expect(screen.queryByText("Finished")).not.toBeInTheDocument();
    expect(screen.getByText(/running · 1m/)).toBeInTheDocument();
  });

  it("has no task line in a transcript recorded without one", async () => {
    show([call({ prompt: "", status: "done" })]);

    await screen.findByRole("feed");
    expect(screen.queryByRole("article", { name: /^Task from/ })).not.toBeInTheDocument();
  });

  it("ends a finished subagent with the report read from its call", async () => {
    vi.mocked(api.getActionOutput).mockResolvedValue({
      text: "All clear.",
      lines: 1,
      truncated: false,
    });
    const { user } = show([call({ status: "done", outputLines: 1 }), said("Done.")]);

    await user.click(await screen.findByRole("button", { name: /Finished/ }));

    expect(await screen.findByText("All clear.")).toBeInTheDocument();
    expect(api.getActionOutput).toHaveBeenCalledWith("task-1", STAGE, expect.any(String));
    expect(screen.getByText(/finished/, { selector: "span" })).toBeInTheDocument();
  });

  it("ends a failed subagent with Failed and its output", async () => {
    vi.mocked(api.getActionOutput).mockResolvedValue({ text: "boom", lines: 1, truncated: false });
    const { user } = show([call({ status: "error", outputLines: 1 })]);

    await user.click(await screen.findByRole("button", { name: /Failed/ }));

    await waitFor(() => expect(document.body).toHaveTextContent("boom"));
  });

  it.each([
    ["interrupted", "user", "Stopped by you"],
    ["interrupted", "agent", "Stopped by the agent"],
    ["interrupted", "crash", "Lost when the session stopped"],
  ])("ends a subagent that is %s by %s with %s", async (status, interruptedBy, text) => {
    show([call({ status, interruptedBy })]);

    expect(await screen.findByRole("article", { name: new RegExp(text) })).toBeInTheDocument();
  });

  it("stops the task of the subagent that runs, from the foot", async () => {
    const { user } = show([call()], { running: true });

    await user.click(await screen.findByRole("button", { name: "Stop" }));

    expect(api.stopTasks).toHaveBeenCalledWith("task-1", STAGE, ["task_a1"]);
  });

  it("shows Stopping… while the stop runs, and the reason it was refused", async () => {
    const task = makeTask({
      running: [
        {
          stage: STAGE,
          tasks: [makeRunningTask({ toolUseId: CALL, stopping: true, stopError: "No task found" })],
        },
      ],
    });
    show([call()]);
    useAppStore.setState({ app: makeState({ tasks: [task] }) });

    expect(await screen.findByRole("button", { name: "Stopping…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't stop it · No task found");
  });

  it("has no Stop without a session, nor once it ended", async () => {
    const { unmount } = show([call()], { running: true, sessionOpen: false });
    await screen.findByRole("feed");
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    unmount();

    show([call({ status: "done" })]);
    await screen.findByRole("feed");
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("goes back to the conversation it came from", async () => {
    const { user } = show([call({ status: "done" })]);
    useAppStore.getState().openSubagentConversation({
      itemId: "task-1",
      stage: STAGE,
      toolUseId: CALL,
      offset: 40,
    });

    await user.click(await screen.findByRole("button", { name: "Back to the conversation" }));

    await waitFor(() => expect(useAppStore.getState().subagentConversation).toBeNull());
    expect(useAppStore.getState().subagentReturn).toEqual({
      itemId: "task-1",
      stage: STAGE,
      toolUseId: CALL,
      offset: 40,
    });
  });
});
