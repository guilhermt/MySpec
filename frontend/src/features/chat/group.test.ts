import { describe, expect, it } from "vitest";
import { groupEntries } from "@/features/chat/group";
import type { Entry } from "@/lib/wails";
import { makeAction, makeEntry } from "@/test/wails-mock";

function action(turnId: string, target: string): Entry {
  return makeEntry("action", {
    turnId,
    action: makeAction({ toolUseId: target, target }),
  });
}

describe("groupEntries", () => {
  it("folds the consecutive actions of one turn together", () => {
    const items = groupEntries([action("turn-1", "a.ts"), action("turn-1", "b.ts")]);

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("actions");
    expect(items[0]?.kind === "actions" && items[0].items.map((one) => one.target)).toEqual([
      "a.ts",
      "b.ts",
    ]);
  });

  it("starts a new group for each turn", () => {
    const items = groupEntries([action("turn-1", "a.ts"), action("turn-2", "b.ts")]);

    expect(items.map((item) => item.kind)).toEqual(["actions", "actions"]);
  });

  it("breaks the group where the agent said something", () => {
    const said = makeEntry("assistant", { turnId: "turn-1" });
    const items = groupEntries([action("turn-1", "a.ts"), said, action("turn-1", "b.ts")]);

    expect(items.map((item) => item.kind)).toEqual(["actions", "entry", "actions"]);
  });

  it("passes every other entry through in order", () => {
    const user = makeEntry("user");
    const marker = makeEntry("marker");
    const items = groupEntries([user, marker]);

    expect(items).toEqual([
      { kind: "entry", key: user.id, entry: user },
      { kind: "entry", key: marker.id, entry: marker },
    ]);
  });

  it("has nothing to group in an empty conversation", () => {
    expect(groupEntries([])).toEqual([]);
  });
});
