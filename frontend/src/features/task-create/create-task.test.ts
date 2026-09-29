import { describe, expect, it } from "vitest";
import {
  CREATE_REASON,
  type CreateBlock,
  characterCount,
  contextLine,
  createBlock,
  nameProblemText,
} from "@/features/task-create/create-task";
import type { NameProblem } from "@/lib/task-name";
import type { BoardCard } from "@/lib/wails";
import { makeBoardCard, makeWritingDiscussion } from "@/test/wails-mock";

const EPIC = {
  key: "acme/api#400",
  repository: "acme/api",
  number: 400,
  title: "Usage-based billing",
  url: "",
  state: "open",
};

const related = (number: number) => ({
  key: `acme/api#${number}`,
  repository: "acme/api",
  number,
  title: `Card ${number}`,
  url: "",
  state: "open",
  status: "Ready",
  onBoard: true,
});

const dependency = (number: number) => ({
  ...related(number),
  pullRequests: [],
  satisfied: false,
});

describe("characterCount", () => {
  it.each([
    ["", "0 characters"],
    ["a", "1 character"],
    ["ab", "2 characters"],
    ["😀", "1 character"],
    ["x".repeat(5690), "5,690 characters"],
  ])("counts %j as %s", (text, want) => {
    expect(characterCount(text)).toBe(want);
  });
});

describe("contextLine", () => {
  const cases: { name: string; card: Partial<BoardCard>; text: string | null; want: string }[] = [
    { name: "the card alone", card: { number: 474 }, text: null, want: "From the card: #474" },
    {
      name: "the epic",
      card: { number: 474, epic: EPIC },
      text: null,
      want: "From the card: #474 and the epic Usage-based billing",
    },
    {
      name: "one card of the epic",
      card: { number: 474, siblings: [related(1)] },
      text: null,
      want: "From the card: #474 and 1 card of the epic",
    },
    {
      name: "several cards of the epic",
      card: { number: 474, siblings: [related(1), related(2)] },
      text: null,
      want: "From the card: #474 and 2 cards of the epic",
    },
    {
      name: "one dependency",
      card: { number: 474, dependencies: [dependency(1)] },
      text: null,
      want: "From the card: #474 and 1 dependency",
    },
    {
      name: "several dependencies",
      card: { number: 474, dependencies: [dependency(1), dependency(2)] },
      text: null,
      want: "From the card: #474 and 2 dependencies",
    },
    {
      name: "the discussion",
      card: { number: 474, writtenBy: makeWritingDiscussion({ title: "Usage alerts" }) },
      text: null,
      want: "From the card: #474 and the discussion Usage alerts",
    },
    {
      name: "every part, with the count",
      card: {
        number: 474,
        epic: EPIC,
        siblings: [related(1), related(2)],
        dependencies: [dependency(3)],
        writtenBy: makeWritingDiscussion({ title: "Usage alerts", archived: true }),
      },
      text: "x".repeat(5690),
      want: "From the card: #474, the epic Usage-based billing, 2 cards of the epic, 1 dependency and the discussion Usage alerts · 5,690 characters",
    },
    {
      name: "one character",
      card: { number: 474 },
      text: "x",
      want: "From the card: #474 · 1 character",
    },
  ];

  it.each(cases)("says $name", ({ card, text, want }) => {
    expect(contextLine(makeBoardCard(card), text)).toBe(want);
  });
});

describe("createBlock", () => {
  const free = { fromCard: false, context: "A rate limiter" };
  const cases: {
    name: string;
    input: Parameters<typeof createBlock>[0];
    want: CreateBlock | null;
  }[] = [
    {
      name: "no repository, before anything else",
      input: { ...free, repositoryId: "", problem: "empty" },
      want: "no-repository",
    },
    {
      name: "an empty name",
      input: { ...free, repositoryId: "r", problem: "empty" },
      want: "no-name",
    },
    {
      name: "an invalid name",
      input: { ...free, repositoryId: "r", problem: "invalid" },
      want: "bad-name",
    },
    {
      name: "a name too long",
      input: { ...free, repositoryId: "r", problem: "too_long" },
      want: "bad-name",
    },
    {
      name: "a name taken",
      input: { ...free, repositoryId: "r", problem: "taken" },
      want: "bad-name",
    },
    {
      name: "a free dialog without context",
      input: { fromCard: false, context: "  ", repositoryId: "r", problem: null },
      want: "no-context",
    },
    {
      name: "a card dialog without context",
      input: { fromCard: true, context: "", repositoryId: "r", problem: null },
      want: null,
    },
    {
      name: "a free dialog with everything",
      input: { ...free, repositoryId: "r", problem: null },
      want: null,
    },
  ];

  it.each(cases)("blocks $name", ({ input, want }) => {
    expect(createBlock(input)).toBe(want);
  });

  it("has a reason for every block", () => {
    expect(CREATE_REASON).toEqual({
      "no-repository": "Choose a repository to create the task.",
      "no-name": "Name the task to create it.",
      "bad-name": "Fix the name to create the task.",
      "no-context": "Say what you want to build.",
    });
  });
});

describe("nameProblemText", () => {
  it.each<[NameProblem, string]>([
    ["empty", ""],
    ["invalid", "Use lowercase letters, digits and single hyphens."],
    ["too_long", "Use at most 64 characters."],
    ["taken", "A task named rate-limit already exists in acme/api."],
  ])("says %s", (problem, want) => {
    expect(nameProblemText(problem, "rate-limit", "acme/api")).toBe(want);
  });
});
