import { describe, expect, it } from "vitest";
import type { Entry, TranscriptEvent } from "@/lib/wails";
import {
  applyEvent,
  emptyTranscript,
  fromTranscript,
  type TranscriptState,
} from "@/store/transcript";
import { makeEntry, makeTranscript } from "@/test/wails-mock";

function ready(entries: Entry[] = [], pending: Entry[] = []): TranscriptState {
  return { status: "ready", entries, pending, buffered: [] };
}

function entryEvent(entry: Entry): TranscriptEvent {
  return { taskId: "task-1", kind: "entry", entry, entryId: "", text: "" };
}

describe("applyEvent", () => {
  it("inserts an entry in seq order", () => {
    const first = makeEntry("user", { id: "a", seq: 1 });
    const third = makeEntry("assistant", { id: "c", seq: 3 });
    const second = makeEntry("action", { id: "b", seq: 2 });

    let state = applyEvent(ready(), entryEvent(first));
    state = applyEvent(state, entryEvent(third));
    state = applyEvent(state, entryEvent(second));

    expect(state.entries.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("replaces an entry it already has instead of duplicating it", () => {
    const running = makeEntry("action", {
      id: "a",
      seq: 1,
      action: {
        toolUseId: "toolu_1",
        tool: "Read",
        label: "Read",
        target: "src/main.tsx",
        status: "running",
      },
    });
    const done = makeEntry("action", { id: "a", seq: 1 });

    let state = applyEvent(ready(), entryEvent(running));
    state = applyEvent(state, entryEvent(done));

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.action?.status).toBe("done");
  });

  it("ignores an entry event without an entry", () => {
    const state = ready([makeEntry("user", { id: "a", seq: 1 })]);

    expect(
      applyEvent(state, { taskId: "task-1", kind: "entry", entry: null, entryId: "", text: "" }),
    ).toBe(state);
  });

  it("keeps a queued message in the pending list", () => {
    const queued = makeEntry("user", {
      id: "a",
      seq: 1,
      user: { text: "later", pending: true, prompt: false },
    });

    const state = applyEvent(ready(), entryEvent(queued));

    expect(state.pending.map((entry) => entry.id)).toEqual(["a"]);
    expect(state.entries).toEqual([]);
  });

  it("moves a queued message to the conversation once it is delivered", () => {
    const queued = makeEntry("user", {
      id: "a",
      seq: 1,
      user: { text: "later", pending: true, prompt: false },
    });
    const delivered = { ...queued, user: { text: "later", pending: false, prompt: false } };

    let state = applyEvent(ready(), entryEvent(queued));
    state = applyEvent(state, entryEvent(delivered));

    expect(state.pending).toEqual([]);
    expect(state.entries.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("keeps queued messages in arrival order when one is replaced", () => {
    const first = makeEntry("user", {
      id: "a",
      seq: 1,
      user: { text: "one", pending: true, prompt: false },
    });
    const second = makeEntry("user", {
      id: "b",
      seq: 2,
      user: { text: "two", pending: true, prompt: false },
    });

    let state = applyEvent(ready(), entryEvent(first));
    state = applyEvent(state, entryEvent(second));
    state = applyEvent(state, entryEvent(first));

    expect(state.pending.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("replaces the text of an assistant entry", () => {
    const entry = makeEntry("assistant", { id: "a", seq: 1 });
    const state = ready([entry]);

    const next = applyEvent(state, {
      taskId: "task-1",
      kind: "text",
      entry: null,
      entryId: "a",
      text: "half a sen",
    });

    expect(next.entries[0]?.assistant?.text).toBe("half a sen");
  });

  it("ignores text for an entry it does not have", () => {
    const state = ready([makeEntry("assistant", { id: "a", seq: 1 })]);

    const next = applyEvent(state, {
      taskId: "task-1",
      kind: "text",
      entry: null,
      entryId: "gone",
      text: "nowhere",
    });

    expect(next).toBe(state);
  });

  it("removes an entry from both lists", () => {
    const entry = makeEntry("user", { id: "a", seq: 1 });
    const queued = makeEntry("user", {
      id: "b",
      seq: 2,
      user: { text: "later", pending: true, prompt: false },
    });
    const state = ready([entry], [queued]);

    const next = applyEvent(
      applyEvent(state, { taskId: "task-1", kind: "remove", entry: null, entryId: "a", text: "" }),
      { taskId: "task-1", kind: "remove", entry: null, entryId: "b", text: "" },
    );

    expect(next.entries).toEqual([]);
    expect(next.pending).toEqual([]);
  });

  it("puts the conversation back in loading on a reset", () => {
    const state: TranscriptState = {
      status: "ready",
      entries: [makeEntry("user", { id: "a", seq: 1 })],
      pending: [],
      buffered: [{ taskId: "task-1", kind: "remove", entry: null, entryId: "a", text: "" }],
    };

    const next = applyEvent(state, {
      taskId: "task-1",
      kind: "reset",
      entry: null,
      entryId: "",
      text: "",
    });

    expect(next.status).toBe("loading");
    expect(next.buffered).toEqual([]);
  });

  it("ignores a kind it does not know", () => {
    const state = ready();

    expect(
      applyEvent(state, { taskId: "task-1", kind: "sideways", entry: null, entryId: "", text: "" }),
    ).toBe(state);
  });
});

describe("emptyTranscript and fromTranscript", () => {
  it("start loading and end ready", () => {
    expect(emptyTranscript()).toEqual({
      status: "loading",
      entries: [],
      pending: [],
      buffered: [],
    });

    const entry = makeEntry("user", { id: "a", seq: 1 });
    expect(fromTranscript(makeTranscript({ entries: [entry] }))).toEqual({
      status: "ready",
      entries: [entry],
      pending: [],
      buffered: [],
    });
  });

  it("tolerates the nil lists of the bindings", () => {
    expect(fromTranscript(makeTranscript({ entries: null, pending: null }))).toEqual({
      status: "ready",
      entries: [],
      pending: [],
      buffered: [],
    });
  });
});
