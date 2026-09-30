import { describe, expect, it } from "vitest";
import { cardViewOf, noticeOf, referenceOf, relationsOf } from "@/features/task/card-panel";
import type { BoardCard } from "@/lib/wails";
import type { BoardCardReading } from "@/store/app-store";
import { makeBoardCard, makeTaskCard } from "@/test/wails-mock";

describe("noticeOf", () => {
  it.each([
    ["missing", { board: "missing", card: null }, "The board of this card was removed."],
    ["unread", { board: "unread", card: null }, "The board hasn't been read yet."],
    [
      "read but without the card",
      { board: "read", card: null },
      "This card isn't in the last reading of the board.",
    ],
    ["read with the card", { board: "read", card: makeBoardCard() }, null],
  ] as const)("says why for %s", (_name, reading, expected) => {
    expect(noticeOf(reading as BoardCardReading)).toBe(expected);
  });
});

describe("referenceOf", () => {
  it.each([
    ["the same repository", { repository: "dev/web", number: 12 }, "dev/web", "#12"],
    ["another repository", { repository: "dev/api", number: 7 }, "dev/web", "dev/api#7"],
  ])("names %s", (_name, item, repository, expected) => {
    expect(referenceOf(item, repository)).toBe(expected);
  });
});

const NO_KEYS: ReadonlySet<string> = new Set();

describe("relationsOf", () => {
  const REPO = "dev/web";
  const group = (card: BoardCard, label: string) =>
    relationsOf(card, NO_KEYS).find((candidate) => candidate.label === label);

  it.each([
    [
      "no epic",
      makeBoardCard({ repository: REPO, epic: null }),
      "Epic",
      [] as { number: string; title: string }[],
    ],
    [
      "the epic, referenced within the repository",
      makeBoardCard({
        repository: REPO,
        epic: {
          key: "e1",
          repository: REPO,
          number: 3,
          title: "Accounts",
          url: "u",
          state: "open",
        },
      }),
      "Epic",
      [{ number: "#3", title: "Accounts" }],
    ],
    [
      "a sibling with a status field",
      makeBoardCard({
        repository: REPO,
        siblings: [
          {
            key: "s1",
            repository: REPO,
            number: 13,
            title: "Reset the password",
            url: "u",
            state: "open",
            status: "In progress",
            onBoard: true,
          },
        ],
      }),
      "Cards of the epic · 1",
      [{ number: "#13", title: "Reset the password" }],
    ],
    [
      "a dependency not satisfied",
      makeBoardCard({
        repository: REPO,
        dependencies: [
          {
            key: "d1",
            repository: "dev/api",
            number: 7,
            title: "Session tokens",
            url: "u",
            state: "open",
            status: "",
            onBoard: false,
            pullRequests: [],
            satisfied: false,
          },
        ],
      }),
      "Dependencies",
      [{ number: "dev/api#7", title: "Session tokens" }],
    ],
    [
      "a linked pull request, with no title",
      makeBoardCard({
        repository: REPO,
        pullRequests: [{ repository: REPO, number: 21, url: "u", state: "open" }],
      }),
      "Pull requests",
      [{ number: "#21", title: "" }],
    ],
  ] as const)("lists %s", (_name, card, label, expected) => {
    expect(group(card, label)?.items.map(({ number, title }) => ({ number, title }))).toEqual(
      expected,
    );
  });

  describe("cardKey", () => {
    const issue = (key: string, onBoard: boolean) => ({
      key,
      repository: REPO,
      number: 1,
      title: key,
      url: "u",
      state: "open",
      status: "",
      onBoard,
    });
    const card = makeBoardCard({
      repository: REPO,
      epic: { key: "e", repository: REPO, number: 3, title: "Accounts", url: "u", state: "open" },
      siblings: [issue("s-in", true), issue("s-out", false), issue("s-off", true)],
      dependencies: [
        { ...issue("d-in", true), pullRequests: [], satisfied: true },
        { ...issue("d-out", false), pullRequests: [], satisfied: true },
      ],
    });
    const keys = new Set(["e", "s-in", "s-out", "d-in", "d-out"]);
    const withKeys = (label: string) =>
      relationsOf(card, keys)
        .find((candidate) => candidate.label === label)
        ?.items.map((item) => item.cardKey);

    it.each([
      ["the epic in the reading", "Epic", ["e"]],
      [
        "the siblings on the board and in the reading",
        "Cards of the epic · 3",
        ["s-in", undefined, undefined],
      ],
      ["the dependencies on the board and in the reading", "Dependencies", ["d-in", undefined]],
    ])("marks %s", (_name, label, expected) => {
      expect(withKeys(label)).toEqual(expected);
    });

    it("marks none without the reading", () => {
      expect(
        relationsOf(card, NO_KEYS)
          .flatMap((g) => g.items)
          .some((i) => i.cardKey),
      ).toBe(false);
    });
  });

  it("warns when a dependency isn't satisfied, and doesn't when it is", () => {
    const card = makeBoardCard({
      repository: REPO,
      dependencies: [
        {
          key: "d1",
          repository: REPO,
          number: 1,
          title: "Not satisfied",
          url: "u",
          state: "open",
          status: "",
          onBoard: false,
          pullRequests: [],
          satisfied: false,
        },
        {
          key: "d2",
          repository: REPO,
          number: 2,
          title: "Satisfied",
          url: "u",
          state: "closed",
          status: "",
          onBoard: false,
          pullRequests: [],
          satisfied: true,
        },
      ],
    });

    const items = group(card, "Dependencies")?.items ?? [];
    expect(items[0]).toMatchObject({ warning: "Not satisfied" });
    expect(items[1]).not.toHaveProperty("warning");
  });
});

describe("cardViewOf", () => {
  it("falls back to what the task keeps, with no body and only the epic among its relations", () => {
    const kept = makeTaskCard({
      repository: "dev/web",
      number: 12,
      title: "Add the login screen",
      status: "In progress",
      epic: { key: "e1", repository: "dev/web", number: 3, title: "Accounts", url: "u", state: "" },
    });

    const view = cardViewOf(kept, null, NO_KEYS);

    expect(view).toMatchObject({
      repository: "dev/web",
      number: 12,
      title: "Add the login screen",
      status: "In progress",
      body: "",
    });
    expect(view.relations).toEqual([
      {
        label: "Epic",
        items: [{ key: "e1", number: "#3", title: "Accounts", meta: "", url: "u" }],
      },
    ]);
  });

  it("reads the card and its relations from the last reading, once it has it", () => {
    const kept = makeTaskCard({ title: "Stale title" });
    const read = makeBoardCard({ title: "Add the login screen", body: "Email and password." });

    const view = cardViewOf(kept, read, NO_KEYS);

    expect(view).toMatchObject({
      title: "Add the login screen",
      body: "Email and password.",
    });
    expect(view.relations).toEqual(relationsOf(read, NO_KEYS));
  });
});
