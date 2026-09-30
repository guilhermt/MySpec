import { describe, expect, it } from "vitest";
import {
  answersOf,
  answerWithText,
  type ComposerContext,
  chipsOf,
  composerLabelOf,
  lastBlockOf,
  otherHeaderOf,
  pendingCardsOf,
  placeholderOf,
  type QuestionChoices,
  quickRepliesOf,
  sendIsPrimary,
} from "@/features/chat/composer";
import type { Entry, Question, QuestionEntry } from "@/lib/wails";
import { makeEntry } from "@/test/wails-mock";

function question(header: string, options: string[], multiSelect = false): Question {
  return {
    question: `Which ${header.toLowerCase()}?`,
    header,
    options: options.map((label) => ({ label, description: "" })),
    multiSelect,
  };
}

function pending(...questions: Question[]): QuestionEntry {
  return {
    requestId: "req-1",
    toolUseId: "toolu_1",
    questions,
    answers: null,
    status: "pending",
    answeredAt: "",
  };
}

const LIMITS = question("Limits", ["Per key", "Per plan"]);
const STORE = question("Store", ["Redis", "Memory"]);
const HEADERS = question("Headers", ["Retry-After", "X-RateLimit-*"], true);

const REST: ComposerContext = {
  who: "implementer",
  paused: false,
  stopped: false,
  turnFailed: false,
  turnRunning: false,
  question: null,
  choices: null,
  otherHeader: null,
  permission: false,
  chips: [],
  findings: false,
  askForChange: false,
  reviseFindings: false,
  item: "task",
};

const CHIPS = [
  { key: "a", text: "In the plans table" },
  { key: "b", text: "In the config" },
];

describe("placeholderOf", () => {
  it.each<[string, Partial<ComposerContext>, string]>([
    [
      "Other… chosen on a card",
      { otherHeader: "Limits", question: pending(LIMITS), paused: true },
      "Write your answer to “Limits” and press Enter…",
    ],
    [
      "a paused session",
      { paused: true, stopped: true, turnRunning: true },
      "Sending resumes the task…",
    ],
    ["a paused review", { paused: true, item: "review" }, "Sending resumes the review…"],
    [
      "a session stopped on an error",
      { stopped: true, turnFailed: true, question: pending(LIMITS) },
      "Sending restarts the implementer's session…",
    ],
    [
      "a turn that failed",
      { turnFailed: true, permission: true },
      "Reply to the implementer to go on…",
    ],
    [
      "a question pending",
      { question: pending(question("Store", ["Redis", "Memory", "Postgres"])), permission: true },
      "Answer with 1–4, or reply to the implementer…",
    ],
    [
      "several questions, none chosen",
      { question: pending(LIMITS, STORE) },
      "Write your answer to “Limits”, or choose above…",
    ],
    [
      "several questions, the first one chosen",
      {
        question: pending(LIMITS, STORE),
        choices: { 0: { labels: ["Per key"], other: null } },
      },
      "Write your answer to “Store”, or choose above…",
    ],
    [
      "several questions, all chosen",
      {
        question: pending(LIMITS, STORE),
        choices: {
          0: { labels: ["Per key"], other: null },
          1: { labels: [], other: "Both" },
        },
      },
      "Write your answer to “Limits”, or choose above…",
    ],
    [
      "a question without options",
      { question: pending(question("Name", [])) },
      "Answer with 1, or reply to the implementer…",
    ],
    [
      "a question of an old transcript without questions",
      { question: { ...pending(), questions: null } },
      "Reply to the implementer…",
    ],
    [
      "a permission pending",
      { permission: true, turnRunning: true },
      "Answer with 1–3 above, or queue a message for the implementer…",
    ],
    ["a turn running", { turnRunning: true, chips: CHIPS }, "Queue a message for the implementer…"],
    [
      "two quick replies",
      { chips: CHIPS, findings: true },
      "Answer a or b, or reply to the implementer…",
    ],
    [
      "three quick replies",
      { chips: [...CHIPS, { key: "c", text: "Both" }] },
      "Answer a, b or c, or reply to the implementer…",
    ],
    [
      "numbered quick replies",
      {
        chips: [
          { key: "1", text: "Yes" },
          { key: "2", text: "No" },
        ],
      },
      "Answer 1 or 2, or reply to the implementer…",
    ],
    [
      "findings in text",
      { who: "PR agent", findings: true, askForChange: true },
      "Tell the PR agent which findings to apply…",
    ],
    [
      "a pass with findings to revise",
      { who: "reviewer", reviseFindings: true, askForChange: true },
      "Ask the reviewer to add, change or drop a finding…",
    ],
    ["a step in review by the user", { askForChange: true }, "Ask the implementer for a change…"],
    ["the rest", {}, "Reply to the implementer…"],
    ["the rest, in the PRD", { who: "PRD agent" }, "Reply to the PRD agent…"],
  ])("says what to write with %s", (_name, context, placeholder) => {
    expect(placeholderOf({ ...REST, ...context })).toBe(placeholder);
  });

  it("names the agent whose session restarts", () => {
    expect(placeholderOf({ ...REST, who: "reviewer", stopped: true })).toBe(
      "Sending restarts the reviewer's session…",
    );
  });
});

describe("composerLabelOf", () => {
  it.each([
    ["implementer", "Reply to the implementer"],
    ["PRD agent", "Reply to the PRD agent"],
  ])("names the composer after %s", (who, label) => {
    expect(composerLabelOf(who)).toBe(label);
  });
});

describe("lastBlockOf", () => {
  it.each([
    ["a paragraph", "Shall I write the PRD?", "Shall I write the PRD?"],
    ["the last of three paragraphs", "One.\n\nTwo.\n\nThree\nlines.", "Three\nlines."],
    ["trailing blank lines", "One.\n\nTwo.\n\n\n", "Two."],
    ["Windows line ends", "One.\r\n\r\nTwo.", "Two."],
    ["a list", "Pick one:\n\na) Yes\nb) No", "a) Yes\nb) No"],
    ["a loose list", "Pick one:\n\n1. Yes\n\n2. No", "1. Yes\n\n2. No"],
    [
      "a list whose item goes on in a paragraph",
      "Pick one:\n\n- Yes\n\n  because it is simpler\n\n- No",
      "- Yes\n\n  because it is simpler\n\n- No",
    ],
    [
      "a paragraph after a list",
      "a) Yes\nb) No\n\nOnce you answer I'll go on.",
      "Once you answer I'll go on.",
    ],
    [
      "a code block with a blank line",
      "Run:\n\n```sh\nmake\n\nmake test\n```",
      "```sh\nmake\n\nmake test\n```",
    ],
    ["nothing", "", ""],
  ])("reads %s", (_name, markdown, block) => {
    expect(lastBlockOf(markdown)).toBe(block);
  });
});

describe("quickRepliesOf", () => {
  it.each([
    [
      "letters",
      "a) Yes\nb) No",
      [
        { key: "a", text: "Yes" },
        { key: "b", text: "No" },
      ],
    ],
    [
      "capital letters",
      "A) Yes\nB) No",
      [
        { key: "A", text: "Yes" },
        { key: "B", text: "No" },
      ],
    ],
    [
      "letters in parentheses",
      "(a) Yes\n(b) No",
      [
        { key: "a", text: "Yes" },
        { key: "b", text: "No" },
      ],
    ],
    [
      "bold letters",
      "**a)** Yes\n**b)** No",
      [
        { key: "a", text: "Yes" },
        { key: "b", text: "No" },
      ],
    ],
    [
      "letters in a bulleted list, with Markdown in the options",
      "- a) **Yes.** Read `plans`\n- b) See [the docs](https://example.com)",
      [
        { key: "a", text: "Yes. Read plans" },
        { key: "b", text: "See the docs" },
      ],
    ],
    [
      "a numbered list",
      "1. Yes\n2. No\n3. Later",
      [
        { key: "1", text: "Yes" },
        { key: "2", text: "No" },
        { key: "3", text: "Later" },
      ],
    ],
    [
      "six options",
      "a) 1\nb) 2\nc) 3\nd) 4\ne) 5\nf) 6",
      ["a", "b", "c", "d", "e", "f"].map((key, index) => ({ key, text: String(index + 1) })),
    ],
    [
      "an option going on over lines",
      "a) Yes,\n   with the cache\nb) No",
      [
        { key: "a", text: "Yes," },
        { key: "b", text: "No" },
      ],
    ],
  ])("offers %s", (_name, block, replies) => {
    expect(quickRepliesOf(block)).toEqual(replies);
  });

  it.each([
    ["a single option", "a) Yes"],
    ["seven options", "a) 1\nb) 2\nc) 3\nd) 4\ne) 5\nf) 6\ng) 7"],
    ["a numbered list of nine", "1. a\n2. b\n3. c\n4. d\n5. e\n6. f\n7. g\n8. h\n9. i"],
    ["letters that skip one", "a) Yes\nc) No"],
    ["letters that don't start at a", "b) Yes\nc) No"],
    ["a numbered list that doesn't start at 1", "2. Yes\n3. No"],
    ["a bulleted list", "- Yes\n- No"],
    ["a paragraph", "Shall I write the PRD?"],
    ["options inside code", "```\na) Yes\nb) No\n```"],
    ["nothing", ""],
  ])("offers nothing for %s", (_name, block) => {
    expect(quickRepliesOf(block)).toEqual([]);
  });

  it("cuts a long option at a word, with the ellipsis inside 48 characters", () => {
    const [first] = quickRepliesOf(
      "a) Yes. Read the limits from the plans table and cache them for 60 s.\nb) No.",
    );

    expect(first?.text).toBe("Yes. Read the limits from the plans table and…");
    expect(first?.text.length).toBeLessThanOrEqual(48);
  });

  it("drops the punctuation before the ellipsis", () => {
    const [first] = quickRepliesOf(
      "a) Read the limits from the plans table, cached, and nothing else\nb) No",
    );

    expect(first?.text).toBe("Read the limits from the plans table, cached…");
  });

  it("cuts a long word where it has to", () => {
    const [first] = quickRepliesOf(`a) ${"x".repeat(60)}\nb) No`);

    expect(first?.text).toBe(`${"x".repeat(47)}…`);
  });

  it("keeps an option of 48 characters whole", () => {
    const text = "y".repeat(48);

    expect(quickRepliesOf(`a) ${text}\nb) No`)[0]?.text).toBe(text);
  });
});

describe("answerWithText", () => {
  it("answers a single question as its Other", () => {
    expect(answerWithText(pending(LIMITS), {}, "  Per team  ")).toEqual({
      choices: { 0: { labels: [], other: "Per team" } },
      complete: true,
    });
  });

  it("answers the first question without a choice and leaves the card incomplete", () => {
    const choices: QuestionChoices = { 0: { labels: ["Per key"], other: null } };

    expect(answerWithText(pending(LIMITS, STORE, HEADERS), choices, "Redis cluster")).toEqual({
      choices: { ...choices, 1: { labels: [], other: "Redis cluster" } },
      complete: false,
    });
  });

  it("answers the question whose Other… waits for its text first", () => {
    const choices: QuestionChoices = { 1: { labels: [], other: "" } };

    expect(answerWithText(pending(LIMITS, STORE), choices, "Disk")).toEqual({
      choices: { 1: { labels: [], other: "Disk" } },
      complete: false,
    });
  });

  it("adds the text as one more choice of a multiSelect", () => {
    const choices: QuestionChoices = {
      0: { labels: ["Per key"], other: null },
      1: { labels: ["Retry-After"], other: "" },
    };

    expect(answerWithText(pending(LIMITS, HEADERS), choices, "Link")).toEqual({
      choices: { ...choices, 1: { labels: ["Retry-After"], other: "Link" } },
      complete: true,
    });
  });

  it("puts the text in place of the option of the first question once every one is chosen", () => {
    const choices: QuestionChoices = {
      0: { labels: ["Per key"], other: null },
      1: { labels: ["Redis"], other: null },
    };

    expect(answerWithText(pending(LIMITS, STORE), choices, "Per team")).toEqual({
      choices: { ...choices, 0: { labels: [], other: "Per team" } },
      complete: true,
    });
  });

  it("changes nothing with a blank text", () => {
    const choices: QuestionChoices = { 0: { labels: ["Per key"], other: null } };

    expect(answerWithText(pending(LIMITS, STORE), choices, "  ")).toEqual({
      choices,
      complete: false,
    });
  });

  it("changes nothing for a question of an old transcript without questions", () => {
    expect(answerWithText({ ...pending(), questions: null }, {}, "Yes")).toEqual({
      choices: {},
      complete: true,
    });
  });
});

describe("answersOf", () => {
  it("joins the labels and the text of Other… by question, as the card sends them", () => {
    const choices: QuestionChoices = {
      0: { labels: ["Per key"], other: null },
      1: { labels: [], other: " Disk " },
      2: { labels: ["Retry-After", "X-RateLimit-*"], other: "Link" },
    };

    expect(answersOf(pending(LIMITS, STORE, HEADERS), choices)).toEqual({
      "Which limits?": "Per key",
      "Which store?": "Disk",
      "Which headers?": "Retry-After, X-RateLimit-*, Link",
    });
  });

  it("answers nothing to a question without a choice, or with Other… still blank", () => {
    expect(answersOf(pending(LIMITS, STORE), { 1: { labels: [], other: "" } })).toEqual({
      "Which limits?": "",
      "Which store?": "",
    });
  });

  it("answers nothing for an old transcript without questions", () => {
    expect(answersOf({ ...pending(), questions: null }, {})).toEqual({});
  });
});

describe("sendIsPrimary", () => {
  it.each([
    ["with text and nothing else primary", "Go on", false, true],
    ["with text and another primary on the screen", "Go on", true, false],
    ["without text", "", false, false],
    ["with blank text", "  \n", false, false],
  ])("decides Send %s", (_name, text, otherPrimary, primary) => {
    expect(sendIsPrimary(text, otherPrimary)).toBe(primary);
  });
});

// said is a complete speech of the agent, or of the subagent a tool use delegated to.
function said(text: string, parentToolUseId = ""): Entry {
  const entry = makeEntry("assistant");
  return entry.assistant === null
    ? entry
    : { ...entry, assistant: { ...entry.assistant, text, parentToolUseId } };
}

function asked(status: string): Entry {
  return makeEntry("question", { question: { ...pending(LIMITS), status } });
}

function permission(status: string): Entry {
  const entry = makeEntry("permission");
  return entry.permission === null
    ? entry
    : { ...entry, permission: { ...entry.permission, status } };
}

describe("pendingCardsOf", () => {
  it.each<[string, Entry[], boolean, boolean]>([
    ["a conversation without cards", [said("Done.")], false, false],
    ["a pending question", [asked("pending")], true, false],
    ["an answered question", [asked("answered")], false, false],
    ["a pending permission", [permission("pending")], false, true],
    ["a cancelled permission", [permission("cancelled")], false, false],
    ["both pending", [asked("pending"), permission("pending")], true, true],
  ])("reads %s", (_name, entries, question, perm) => {
    const cards = pendingCardsOf(entries);
    expect(cards.question !== null).toBe(question);
    expect(cards.permission).toBe(perm);
  });
});

describe("chipsOf", () => {
  const OPTIONS = "Which one?\n\na) Per key\nb) Per plan";

  it.each<[string, Entry[], string[]]>([
    ["the options of the last speech", [said(OPTIONS)], ["a", "b"]],
    ["a speech without options", [said(OPTIONS), said("Done.")], []],
    [
      "the agent's speech, not the subagent's after it",
      [said(OPTIONS), said("x", "toolu_9")],
      ["a", "b"],
    ],
    ["no speech at all", [asked("answered")], []],
  ])("reads %s", (_name, entries, keys) => {
    expect(chipsOf(entries).map((chip) => chip.key)).toEqual(keys);
  });
});

describe("otherHeaderOf", () => {
  it.each<[string, QuestionChoices, string | null]>([
    ["no choice", {}, null],
    ["Other… chosen without its text", { 1: { labels: [], other: "" } }, "Store"],
    ["Other… with its text", { 1: { labels: [], other: "Disk" } }, null],
  ])("reads %s", (_name, choices, header) => {
    expect(otherHeaderOf(pending(LIMITS, STORE), choices)).toBe(header);
  });

  it("has no header without a question", () => {
    expect(otherHeaderOf(null, { 0: { labels: [], other: "" } })).toBeNull();
  });
});
