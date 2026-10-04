import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Conversation } from "@/features/chat/Conversation";
import { IDLE_SESSION } from "@/features/chat/session";
import type { Entry } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeAction, makeEntry, makeState, makeTask } from "@/test/wails-mock";

// How many times each entry component rendered, by the createdAt of the speech or the line, or the
// key of the group. React's Profiler does not tell the rows apart.
const renders = vi.hoisted(() => new Map<string, number>());
const count = (key: string) => renders.set(key, (renders.get(key) ?? 0) + 1);

vi.mock("@/features/chat/entries/Speech", () => ({
  Speech: ({ createdAt }: { createdAt: string }) => {
    count(`speech ${createdAt}`);
    return <p>{createdAt}</p>;
  },
}));
vi.mock("@/features/chat/entries/MarkerLine", () => ({
  MarkerLine: ({ createdAt }: { createdAt: string }) => {
    count(`line ${createdAt}`);
    return <p>{createdAt}</p>;
  },
}));
vi.mock("@/features/chat/entries/Group", () => ({
  Group: ({ group }: { group: { key: string } }) => {
    count(`group ${group.key}`);
    return <p>{group.key}</p>;
  },
}));

const at = (seq: number) => new Date(Date.UTC(2026, 8, 5, 10, 0, seq)).toISOString();

// fifty entries: a speech, a marker and a group of two actions, over and over.
function fifty(): Entry[] {
  const entries: Entry[] = [];
  for (let turn = 0; entries.length < 50; turn += 1) {
    const turnId = `turn-${turn}`;
    const add = (entry: Entry) => entries.push({ ...entry, turnId, createdAt: at(entries.length) });
    add(makeEntry("assistant"));
    add(makeEntry("marker"));
    for (const id of ["a", "b"]) {
      add(
        makeEntry("action", { action: makeAction({ toolUseId: `${turn}${id}`, status: "done" }) }),
      );
    }
  }
  return entries.slice(0, 50);
}

describe("Conversation renders", () => {
  beforeEach(() => renders.clear());

  it("renders only the row whose text grew", () => {
    const entries = fifty();
    const last = entries.filter((entry) => entry.kind === "assistant").at(-1);
    if (last === undefined) {
      throw new Error("no speech");
    }
    renderWithStore(<Conversation stage="step:1" taskId="task-1" session={IDLE_SESSION} />, {
      state: makeState({ tasks: [makeTask()] }),
      ui: {
        transcripts: {
          "task-1|step:1": { status: "ready", error: "", entries, pending: [], buffered: [] },
        },
      },
    });
    expect(renders.size).toBeGreaterThan(30);
    renders.clear();

    act(() => {
      useAppStore.getState().applyTranscriptEvent({
        taskId: "task-1",
        stage: "step:1",
        kind: "text",
        entry: null,
        entryId: last.id,
        text: "more words",
      });
    });

    expect([...renders]).toEqual([[`speech ${last.createdAt}`, 1]]);
  });
});
