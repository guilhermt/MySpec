import { describe, expect, it } from "vitest";
import {
  subagentConversationOf,
  subagentEndView,
  subagentStatusText,
} from "@/features/chat/subagent";
import type { ActionEntry, Entry } from "@/lib/wails";
import { makeAction, makeEntry } from "@/test/wails-mock";

const CALL = "toolu_agent";

function call(overrides: Partial<ActionEntry> = {}): Entry {
  return makeEntry("action", {
    turnId: "turn-1",
    action: makeAction({
      toolUseId: CALL,
      tool: "Agent",
      description: "Survey the repository",
      prompt: "Read the sessions and report.",
      status: "running",
      ...overrides,
    }),
  });
}

function child(toolUseId: string, parent = CALL, turnId = "turn-1"): Entry {
  return makeEntry("action", {
    turnId,
    action: makeAction({ toolUseId, parentToolUseId: parent }),
  });
}

function said(text: string, parent = CALL, turnId = "turn-1"): Entry {
  const entry = makeEntry("assistant", { turnId });
  return {
    ...entry,
    assistant: entry.assistant && { ...entry.assistant, text, parentToolUseId: parent },
  };
}

describe("subagentConversationOf", () => {
  it("gathers the speeches and the actions that arrived after another turn, as one turn", () => {
    const entries = [
      call(),
      makeEntry("assistant", { turnId: "turn-1" }),
      said("Looking at the sessions.", CALL, "turn-2"),
      child("toolu_a", CALL, "turn-2"),
      makeEntry("assistant", { turnId: "turn-2" }),
      child("toolu_b", CALL, "turn-3"),
    ];
    const model = subagentConversationOf(entries, CALL);
    expect(model.name).toBe("Survey the repository");
    expect(model.prompt).toBe("Read the sessions and report.");
    expect(model.entries).toHaveLength(3);
    expect(model.entries.map((entry) => entry.seq)).toEqual(
      [...model.entries.map((entry) => entry.seq)].sort((a, b) => a - b),
    );
    expect(new Set(model.entries.map((entry) => entry.turnId))).toEqual(new Set(["turn-1"]));
    expect(model.entries.every((entry) => (entry.assistant?.parentToolUseId ?? "") === "")).toBe(
      true,
    );
    expect(model.entries.every((entry) => (entry.action?.parentToolUseId ?? "") === "")).toBe(true);
  });

  it("leaves out what belongs to another subagent", () => {
    const entries = [call(), child("toolu_a"), child("toolu_x", "toolu_other")];
    expect(subagentConversationOf(entries, CALL).entries.map((e) => e.action?.toolUseId)).toEqual([
      "toolu_a",
    ]);
  });

  it("keeps a subagent inside the subagent under its call", () => {
    const nested = call();
    const entries = [nested, child("toolu_inner"), child("toolu_deep", "toolu_inner")];
    const parents = subagentConversationOf(entries, CALL).entries.map(
      (entry) => entry.action?.parentToolUseId,
    );
    expect(parents).toEqual(["", "toolu_inner"]);
  });

  it("opens a transcript recorded before the prompt and the background", () => {
    const old = makeEntry("action", {
      action: makeAction({
        toolUseId: CALL,
        tool: "Task",
        target: "general-purpose",
        status: "done",
      }),
    });
    const model = subagentConversationOf([old], CALL);
    expect(model.prompt).toBe("");
    expect(model.name).toBe("general-purpose");
    expect(model.status).toBe("finished");
  });

  it("has no root when the transcript has none", () => {
    const model = subagentConversationOf([child("toolu_a")], CALL);
    expect(model.root).toBeNull();
    expect(model.entries).toEqual([]);
  });

  it.each([
    [{ status: "running" }, "running"],
    [{ status: "done" }, "finished"],
    [{ status: "error" }, "failed"],
    [{ status: "interrupted", interruptedBy: "user" }, "stopped"],
    [{ status: "interrupted", interruptedBy: "agent" }, "stoppedByAgent"],
    [{ status: "interrupted", interruptedBy: "crash" }, "lost"],
  ] as const)("reads the status of %j as %s", (overrides, status) => {
    expect(subagentConversationOf([call(overrides)], CALL).status).toBe(status);
  });
});

describe("subagentStatusText", () => {
  const started = "2026-09-05T10:00:00Z";
  const now = Date.parse(started) + (3 * 60 + 12) * 1000;

  it.each([
    ["running", "running · 3m 12s"],
    ["finished", "finished"],
    ["failed", "failed"],
    ["stopped", "stopped by you"],
    ["stoppedByAgent", "stopped by the agent"],
    ["lost", "lost"],
  ] as const)("says %s", (status, text) => {
    expect(subagentStatusText(status, started, now)).toBe(text);
  });
});

describe("subagentEndView", () => {
  it("has no line while it runs", () => {
    expect(subagentEndView("running", null)).toBeNull();
  });

  it("closes a finished one with its report", () => {
    const view = subagentEndView("finished", "All **done**.");
    expect(view).toMatchObject({ icon: "check", text: "Finished" });
    expect(view?.body).toEqual({ kind: "markdown", text: "All **done**." });
  });

  it("closes a failed one with its output as code", () => {
    const view = subagentEndView("failed", "boom");
    expect(view).toMatchObject({ icon: "problem", text: "Failed" });
    expect(view?.body).toEqual({ kind: "markdown", text: "```text\nboom\n```" });
  });

  it.each([
    ["stopped", "ban", "Stopped by you"],
    ["stoppedByAgent", "ban", "Stopped by the agent"],
    ["lost", "lost", "Lost when the session stopped"],
  ] as const)("closes %s with no body", (status, icon, text) => {
    expect(subagentEndView(status, "ignored")).toMatchObject({
      icon,
      text,
      body: { kind: "none" },
    });
  });
});
