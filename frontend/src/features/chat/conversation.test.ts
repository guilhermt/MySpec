import { describe, expect, it } from "vitest";
import {
  buildConversation,
  type ConversationModel,
  foldableStretches,
  type GroupModel,
  lastMarkerOf,
  type Row,
  type Stretch,
  stretchFoldOf,
} from "@/features/chat/conversation";
import type { MarkerContext } from "@/features/chat/markers";
import type { ActionEntry, Entry, MarkerEntry, UserEntry } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { makeAction, makeEntry, makeStep, makeTask } from "@/test/wails-mock";

// A marker and a message as an old transcript keeps them: every field at its zero.
const MARKER: MarkerEntry = {
  type: "compacted",
  preTokens: 0,
  stage: "",
  step: 0,
  pass: 0,
  clean: false,
  findings: -1,
  restarted: false,
  percent: 0,
  attempts: 0,
  reason: "",
  interruptedBy: "",
  sha: "",
  subject: "",
  pushed: false,
  number: 0,
  base: "",
  passed: 0,
  total: 0,
  failed: [],
  conflict: false,
  title: "",
  files: 0,
  problems: [],
  model: "",
  effort: "",
  mode: "",
  approved: 0,
  discarded: 0,
  verdict: "",
  inline: 0,
  body: 0,
  summary: false,
  minimal: false,
  url: "",
  commits: [],
  count: 0,
};
const USER: UserEntry = {
  text: "",
  pending: false,
  prompt: false,
  app: false,
  sent: "",
  appKind: "",
  appPass: 0,
  appRound: 0,
  appRounds: 0,
  appCount: 0,
};

const at = (minute: number, second = 0) =>
  `2026-09-28T13:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}Z`;

const marker = (fields: Partial<MarkerEntry>, turnId = "turn-0"): Entry =>
  makeEntry("marker", { turnId, marker: { ...MARKER, ...fields } });
const user = (fields: Partial<UserEntry>, turnId = "turn-0"): Entry =>
  makeEntry("user", { turnId, user: { ...USER, ...fields } });
const said = (text: string, messageId = "msg_1", fields: Partial<Entry> = {}): Entry => {
  const entry = makeEntry("assistant", fields);
  return entry.assistant === null
    ? entry
    : { ...entry, assistant: { ...entry.assistant, text, messageId } };
};
const subagentSaid = (parent: string) => {
  const entry = said("Looking at the e2e test.");
  return entry.assistant === null
    ? entry
    : { ...entry, assistant: { ...entry.assistant, parentToolUseId: parent } };
};
const act = (turnId: string, fields: Partial<ActionEntry>, createdAt = at(48)): Entry =>
  makeEntry("action", { turnId, createdAt, action: makeAction(fields) });
const read = (turnId: string, id: string, fields: Partial<ActionEntry> = {}) =>
  act(turnId, { toolUseId: id, tool: "Read", target: `${id}.go`, ...fields });

const stageStarted = (stage: string) => marker({ type: "stage_started", stage });
const product = (fields: Partial<UserEntry>, createdAt = at(50)): Entry => {
  const entry = user({ app: true, text: "The report.", ...fields });
  return { ...entry, createdAt };
};

const rowsOf = (model: ConversationModel): Row[] =>
  model.stretches.flatMap((stretch) => stretch.rows);
const kinds = (model: ConversationModel) => rowsOf(model).map((row) => row.kind);
const groupsOf = (model: ConversationModel): GroupModel[] =>
  rowsOf(model).flatMap((row) => (row.kind === "group" ? [row.group] : []));
const voices = (model: ConversationModel) =>
  rowsOf(model).flatMap((row) => (row.kind === "speech" ? [row.voice] : []));

describe("buildConversation", () => {
  it("draws nothing for an empty conversation", () => {
    expect(buildConversation([], "Implementer")).toEqual({ stretches: [] });
  });

  it("joins the start marker and the prompt after it in one line", () => {
    const start = stageStarted("tech_spec");
    const first = user({ prompt: true, sent: "Write the tech spec." });
    const model = buildConversation([start, first], "Tech spec agent");

    expect(rowsOf(model)).toEqual([{ kind: "start", key: start.id, marker: start, prompt: first }]);
  });

  it("keeps the empty prompt of today with its marker, and drops it without one", () => {
    const start = stageStarted("plan");
    const empty = user({ prompt: true });
    const alone = user({ prompt: true });

    expect(rowsOf(buildConversation([start, empty], "Plan agent"))).toEqual([
      { kind: "start", key: start.id, marker: start, prompt: empty },
    ]);
    expect(kinds(buildConversation([alone, said("Hi.")], "Plan agent"))).toEqual(["speech"]);
  });

  it("draws a start marker whose prompt has not arrived as a start line alone", () => {
    const start = marker({ type: "step_started", step: 3 });
    const model = buildConversation([start], "Implementer");

    expect(rowsOf(model)).toEqual([{ kind: "start", key: start.id, marker: start, prompt: null }]);
  });

  it("draws a prompt without its marker, from an old transcript, as a start line", () => {
    const first = user({ prompt: true, text: "Limit each API key." });

    expect(rowsOf(buildConversation([first], "PRD agent"))).toEqual([
      { kind: "start", key: first.id, marker: null, prompt: first },
    ]);
  });

  it("draws the start of a review alone, and what you wrote for the first pass as your message", () => {
    const start = marker({
      type: "review_started",
      model: "claude-opus-5-5",
      effort: "high",
      mode: "publish",
    });
    const first = user({
      prompt: true,
      text: "Look at the migrations.",
      sent: "Review the pull request.",
    });
    const model = buildConversation([start, first, said("Reading the diff.")], "Reviewer");

    expect(rowsOf(model)).toEqual([
      { kind: "start", key: start.id, marker: start, prompt: null },
      { kind: "user", key: first.id, entry: first },
      expect.objectContaining({ kind: "speech" }),
    ]);
  });

  it("draws nothing for the prompt of a review when you wrote nothing for the first pass", () => {
    const start = marker({ type: "review_started" });
    const first = user({ prompt: true, text: "  ", sent: "Review the pull request." });
    const model = buildConversation([start, first, said("Reading the diff.")], "Reviewer");

    expect(kinds(model)).toEqual(["start", "speech"]);
    expect(rowsOf(model)[0]).toEqual({ kind: "start", key: start.id, marker: start, prompt: null });
  });

  it("draws the start of a review alone when its prompt has not arrived", () => {
    const start = marker({ type: "review_started" });

    expect(rowsOf(buildConversation([start], "Reviewer"))).toEqual([
      { kind: "start", key: start.id, marker: start, prompt: null },
    ]);
  });

  it("turns the start of a reviewer and its prompt into the first message of the product", () => {
    const start = marker({ type: "step_review_started", step: 3 });
    const first = user({ prompt: true, app: true, text: "Step 3 is done." });
    const model = buildConversation([start, first, said("Reading the diff.")], "Reviewer");

    expect(rowsOf(model)[0]).toEqual({
      kind: "product",
      key: first.id,
      entry: first,
      firstReviewerPass: true,
    });
    expect(kinds(model)).toEqual(["product", "speech"]);
  });

  it.each<[string, Partial<UserEntry>, Row["kind"]]>([
    ["a message of yours", {}, "user"],
    ["a message of the product", { app: true, appKind: "commit" }, "product"],
    ["a message of the product in an old transcript", { app: true }, "product"],
  ])("draws %s", (_, fields, expected) => {
    expect(kinds(buildConversation([user({ text: "Go on.", ...fields })], "Implementer"))).toEqual([
      expected,
    ]);
  });

  it.each<[string, Entry, Row["kind"]]>([
    ["a question", makeEntry("question"), "question"],
    ["a permission", makeEntry("permission"), "permission"],
    ["an error", makeEntry("error"), "error"],
    ["a marker", marker({ type: "paused" }), "marker"],
  ])("draws %s as its own row", (_, entry, expected) => {
    expect(kinds(buildConversation([entry], "Implementer"))).toEqual([expected]);
  });

  it("does not draw the speech of a subagent, nor lets it break the group", () => {
    const model = buildConversation(
      [
        act("turn-1", { toolUseId: "agent", tool: "Agent", status: "running" }),
        subagentSaid("agent"),
        read("turn-1", "a", { parentToolUseId: "agent" }),
      ],
      "PR agent",
    );

    expect(kinds(model)).toEqual(["group"]);
  });

  it("does not draw a marker of a type it does not know, nor lets it break the group", () => {
    const model = buildConversation(
      [read("turn-1", "a"), marker({ type: "rewound" }, "turn-1"), read("turn-1", "b")],
      "Implementer",
    );

    expect(kinds(model)).toEqual(["group"]);
    expect(groupsOf(model)[0]?.count).toBe(2);
  });
});

describe("buildConversation groups", () => {
  it("folds the consecutive actions of one turn together", () => {
    const first = read("turn-1", "a");
    const model = buildConversation([first, read("turn-1", "b")], "Implementer");

    expect(kinds(model)).toEqual(["group"]);
    expect(groupsOf(model)[0]).toMatchObject({ key: first.id, count: 2, summary: "Read 2" });
  });

  it("starts a new group for each turn", () => {
    const model = buildConversation([read("turn-1", "a"), read("turn-2", "b")], "Implementer");
    expect(kinds(model)).toEqual(["group", "group"]);
  });

  it("breaks the group where the agent said something", () => {
    const model = buildConversation(
      [read("turn-1", "a"), said("Found it.", "msg_1", { turnId: "turn-1" }), read("turn-1", "b")],
      "Implementer",
    );
    expect(kinds(model)).toEqual(["group", "speech", "group"]);
  });

  it("nests the actions of a subagent under it, a subagent inside it included", () => {
    const agent = act("turn-1", { toolUseId: "agent", tool: "Agent", status: "done" });
    const inner = act("turn-1", {
      toolUseId: "inner",
      tool: "Agent",
      parentToolUseId: "agent",
    });
    const model = buildConversation(
      [
        read("turn-1", "a"),
        agent,
        read("turn-1", "b", { parentToolUseId: "agent" }),
        inner,
        read("turn-1", "c", { parentToolUseId: "inner" }),
      ],
      "PR agent",
    );
    const [group] = groupsOf(model);

    expect(group?.count).toBe(2);
    expect(group?.summary).toBe("Read 1 · Delegated 1");
    expect(group?.nodes[1]?.children.map((child) => child.action.toolUseId)).toEqual([
      "b",
      "inner",
      "c",
    ]);
  });

  it("leaves an action loose when its subagent is not in the group, as in an old transcript", () => {
    const model = buildConversation(
      [read("turn-1", "a", { parentToolUseId: "gone" }), read("turn-1", "b")],
      "Implementer",
    );
    expect(groupsOf(model)[0]?.nodes.map((node) => node.children.length)).toEqual([0, 0]);
  });

  it("folds a retry between two actions of the group into it", () => {
    const model = buildConversation(
      [
        read("turn-1", "a"),
        marker({ type: "retried", attempts: 2 }, "turn-1"),
        marker({ type: "retried", attempts: 1 }, "turn-1"),
        read("turn-1", "b"),
      ],
      "Implementer",
    );

    expect(kinds(model)).toEqual(["group"]);
    expect(groupsOf(model)[0]).toMatchObject({ count: 2, retried: 3 });
  });

  it("draws a retry after the last action of a group as a marker", () => {
    const model = buildConversation(
      [read("turn-1", "a"), marker({ type: "retried", attempts: 2 }, "turn-1"), said("Done.")],
      "Implementer",
    );
    expect(kinds(model)).toEqual(["group", "marker", "speech"]);
  });

  it("draws a retry between two turns as a marker", () => {
    const model = buildConversation(
      [read("turn-1", "a"), marker({ type: "retried", attempts: 2 }), read("turn-2", "b")],
      "Implementer",
    );
    expect(kinds(model)).toEqual(["group", "marker", "group"]);
  });

  it("measures a group from the start of its first action to the end of its last", () => {
    const model = buildConversation(
      [
        read("turn-1", "a", { startedAt: at(48, 0), finishedAt: at(48, 1) }),
        read("turn-1", "b", { startedAt: at(48, 5), finishedAt: at(49, 50) }),
      ],
      "Implementer",
    );
    expect(groupsOf(model)[0]).toMatchObject({
      startedAt: at(48, 0),
      durationMs: 110_000,
      running: null,
    });
  });

  it("has no duration and starts at its entry in an old transcript", () => {
    const model = buildConversation([read("turn-1", "a")], "Implementer");
    expect(groupsOf(model)[0]).toMatchObject({ startedAt: at(48), durationMs: null });
  });

  it("names the running action, the subagent's when it works", () => {
    const child = read("turn-1", "b", { parentToolUseId: "agent", status: "running" });
    const model = buildConversation(
      [
        read("turn-1", "a", { startedAt: at(48), finishedAt: at(48, 2) }),
        act("turn-1", { toolUseId: "agent", tool: "Agent", status: "running" }),
        read("turn-1", "x", { parentToolUseId: "agent" }),
        child,
      ],
      "PR agent",
    );
    const [group] = groupsOf(model);

    expect(group?.running?.entry).toBe(child);
    expect(group?.durationMs).toBeNull();
  });

  it("names a running subagent that is not running an action", () => {
    const agent = act("turn-1", { toolUseId: "agent", tool: "Agent", status: "running" });
    const model = buildConversation(
      [agent, read("turn-1", "x", { parentToolUseId: "agent" })],
      "PR agent",
    );
    expect(groupsOf(model)[0]?.running?.entry).toBe(agent);
  });

  it("notes the failures and the action that waits for the permission", () => {
    const permission = makeEntry("permission");
    const pending =
      permission.permission === null
        ? permission
        : { ...permission, permission: { ...permission.permission, toolUseId: "rm" } };
    const model = buildConversation(
      [
        act("turn-1", { toolUseId: "t1", tool: "Bash", target: "go test ./...", status: "error" }),
        act("turn-1", { toolUseId: "rm", tool: "Bash", target: "rm -rf dist", status: "running" }),
        pending,
      ],
      "Implementer",
    );

    expect(groupsOf(model)[0]?.notes).toEqual([
      { text: "1 failed", tone: "error" },
      { text: "1 waits for your permission", tone: "meta" },
    ]);
  });
});

describe("buildConversation voice", () => {
  it("writes the voice at the start and after you, the product and a start line only", () => {
    const model = buildConversation(
      [
        said("First."),
        read("turn-1", "a"),
        said("After the actions."),
        marker({ type: "paused" }),
        said("After a marker."),
        makeEntry("question"),
        said("After a question."),
        user({ text: "Go on." }),
        said("After you."),
        product({ appKind: "commit" }),
        said("After the product."),
        stageStarted("pr"),
        said("After the start."),
      ],
      "Implementer",
    );

    expect(voices(model)).toEqual([
      "Implementer",
      null,
      null,
      null,
      "Implementer",
      "Implementer",
      "Implementer",
    ]);
  });

  it("writes the voice once for the blocks of one message", () => {
    const model = buildConversation([said("One.", "msg_1"), said("Two.", "msg_1")], "Reviewer");
    expect(voices(model)).toEqual(["Reviewer", null]);
  });
});

describe("buildConversation stretches", () => {
  const report = (pass: number, createdAt: string) =>
    product(
      { appKind: "report", appPass: pass, appRound: pass, appRounds: 3, appCount: 3 },
      createdAt,
    );

  it("opens a stretch at each message of the product that opens a round", () => {
    const start = marker({ type: "step_started", step: 3 });
    const first = { ...user({ prompt: true }), createdAt: at(12) };
    const model = buildConversation(
      [
        { ...start, createdAt: at(12) },
        first,
        said("Reading.", "msg_1", { createdAt: at(13) }),
        read("turn-1", "a", { startedAt: at(14), finishedAt: at(15) }),
        read("turn-1", "b", { startedAt: at(16), finishedAt: at(18) }),
        said("Done.", "msg_2", { createdAt: at(17) }),
        product({ appKind: "commit" }, at(18)),
        report(1, at(20)),
        said("Fixing.", "msg_3", { createdAt: at(21) }),
        product({ appKind: "pass", appPass: 2 }, at(30)),
        product({ appKind: "pr_pass", appPass: 2 }, at(31)),
        product({ appKind: "apply", appCount: 3 }, at(32)),
        product({ appKind: "correction", appRound: 1, appRounds: 3, appCount: 2 }, at(33)),
        product({ appKind: "open" }, at(34)),
      ],
      "Implementer",
    );

    expect(
      model.stretches.map(({ from, speeches, actions, startedAt, endedAt, rows }) => ({
        from,
        speeches,
        actions,
        startedAt,
        endedAt,
        rows: rows.length,
      })),
    ).toEqual([
      { from: "", speeches: 2, actions: 2, startedAt: at(12), endedAt: at(18), rows: 5 },
      {
        from: "Review 1 · 3 findings · round 1 of 3",
        speeches: 1,
        actions: 0,
        startedAt: at(20),
        endedAt: at(21),
        rows: 2,
      },
      {
        from: "pass 2 · the implementer is done with your last report",
        speeches: 0,
        actions: 0,
        startedAt: at(30),
        endedAt: at(30),
        rows: 1,
      },
      {
        from: "pass 2 · review the pull request again",
        speeches: 0,
        actions: 0,
        startedAt: at(31),
        endedAt: at(31),
        rows: 1,
      },
      {
        from: "apply 3 approved findings",
        speeches: 0,
        actions: 0,
        startedAt: at(32),
        endedAt: at(32),
        rows: 1,
      },
      {
        from: "The plan isn't valid yet · 2 problems · correction 1 of 3",
        speeches: 0,
        actions: 0,
        startedAt: at(33),
        endedAt: at(34),
        rows: 2,
      },
    ]);
    expect(model.stretches[0]?.key).toBe(start.id);
  });

  it("keeps an old transcript, whose messages of the product have no kind, in one stretch", () => {
    const model = buildConversation(
      [said("One."), product({}), said("Two.", "msg_2"), product({})],
      "Implementer",
    );
    expect(model.stretches).toHaveLength(1);
  });
});

describe("foldableStretches", () => {
  const speeches = (count: number, from: number) =>
    Array.from({ length: count }, (_, index) =>
      said(`Speech ${from + index}.`, `msg_${from + index}`),
    );
  const report = (pass: number) =>
    product({ appKind: "report", appPass: pass, appRound: pass, appRounds: 3, appCount: 1 });

  it("folds the stretches before the last with at least twelve rows", () => {
    const model = buildConversation(
      [
        ...speeches(12, 0),
        report(1),
        ...speeches(10, 20),
        report(2),
        ...speeches(11, 40),
        report(3),
        ...speeches(20, 60),
      ],
      "Implementer",
    );
    const keys = model.stretches.map((stretch) => stretch.key);

    expect(model.stretches.map((stretch) => stretch.rows.length)).toEqual([12, 11, 12, 21]);
    expect(foldableStretches(model)).toEqual(new Set([keys[0], keys[2]]));
  });

  it("never folds the only stretch", () => {
    expect(foldableStretches(buildConversation(speeches(30, 0), "Implementer"))).toEqual(new Set());
  });
});

describe("lastMarkerOf", () => {
  const invalid = (message: string) =>
    marker({ type: "plan_invalid", problems: [{ file: "2-api.md", message }] });
  const correction = product({ appKind: "correction", appRound: 1, appRounds: 3, appCount: 1 });

  it("finds the last marker of a type, in the stretch it is drawn in", () => {
    const older = invalid("no repository");
    const newer = invalid("no title");
    const model = buildConversation(
      [older, said("Fixing."), correction, newer, said("Still wrong.", "msg_2")],
      "Plan agent",
    );

    expect(lastMarkerOf(model, "plan_invalid")).toEqual({
      stretch: model.stretches[1]?.key,
      row: newer.id,
    });
  });

  it("finds nothing in a conversation without one", () => {
    expect(lastMarkerOf(buildConversation([said("Done.")], "Plan agent"), "plan_invalid")).toBe(
      null,
    );
  });
});

describe("stretchFoldOf", () => {
  const NOW = Date.parse(at(59));
  const ctx: MarkerContext = {
    stage: "step:6",
    task: makeTask({ steps: [makeStep({ number: 6, file: "06-throttle-metrics.md" })] }),
    review: null,
    latestReport: new Map(),
    oneShot: false,
  };
  const stretch = (fields: Partial<Stretch>): Stretch => ({
    key: "entry-1",
    rows: [],
    speeches: 5,
    actions: 71,
    from: "",
    startedAt: at(12),
    endedAt: at(48),
    ...fields,
  });

  it("tells the first stretch from the start line, with its size and its interval", () => {
    const start = marker({ type: "step_started", step: 6 });
    const rows: Row[] = [{ kind: "start", key: start.id, marker: start, prompt: null }];
    const interval = `${clockTime(at(12), NOW)}–${clockTime(at(48), NOW)}`;

    expect(stretchFoldOf(stretch({ rows }), ctx, NOW)).toEqual({
      text: "5 speeches · 71 actions",
      from: "from the start · steps/06-throttle-metrics.md",
      interval,
      name: `Earlier: 5 speeches and 71 actions, from the start, ${clockTime(at(12), NOW)} to ${clockTime(at(48), NOW)}`,
    });
  });

  it("tells a stretch opened by the product from its message, in the singular when one", () => {
    const view = stretchFoldOf(
      stretch({ from: "Review 1 · 3 findings · round 1 of 3", speeches: 1, actions: 1 }),
      ctx,
      NOW,
    );

    expect(view.text).toBe("1 speech · 1 action");
    expect(view.from).toBe("from Review 1 · 3 findings · round 1 of 3");
    expect(view.name).toMatch(
      /^Earlier: 1 speech and 1 action, from Review 1 · 3 findings · round 1 of 3, /,
    );
  });

  it("says only from the start without a start line, and no interval without the times", () => {
    const view = stretchFoldOf(stretch({ startedAt: "", endedAt: "" }), ctx, NOW);

    expect(view).toMatchObject({ from: "from the start", interval: "" });
    expect(view.name).toBe("Earlier: 5 speeches and 71 actions, from the start");
  });
});
