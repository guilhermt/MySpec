import { describe, expect, it } from "vitest";
import { discussionBoard } from "@/features/sidebar/new-discussion-board";
import { HOME, type Location } from "@/lib/locations";
import type { State } from "@/lib/wails";
import { makeBoard, makeDiscussion, makeRepository, makeState, makeTask } from "@/test/wails-mock";

const ALPHA = makeBoard({ id: "alpha", title: "Alpha" });
const BETA = makeBoard({ id: "beta", title: "Beta" });
const GAMMA = makeBoard({ id: "gamma", title: "Gamma" });

// web belongs to Beta, api to no board. The last discussion is of Gamma.
const APP = makeState({
  boards: [ALPHA, BETA, GAMMA],
  repositories: [
    makeRepository({ id: "web", boardId: "beta" }),
    makeRepository({ id: "api", fullName: "dev/api", boardId: "" }),
  ],
  tasks: [
    makeTask({ id: "on-beta", repositoryId: "web" }),
    makeTask({ id: "no-board", repositoryId: "api" }),
  ],
  discussions: [
    makeDiscussion({ id: "on-alpha", boardId: "alpha" }),
    makeDiscussion({ id: "on-gamma", boardId: "gamma" }),
  ],
});

describe("discussionBoard", () => {
  const cases: { name: string; app: State; location: Location; want: string | null }[] = [
    {
      name: "the board on screen",
      app: APP,
      location: { kind: "board", id: "alpha" },
      want: "alpha",
    },
    {
      name: "the board of the task on screen, by its repository",
      app: APP,
      location: { kind: "task", id: "on-beta" },
      want: "beta",
    },
    {
      name: "the board of the discussion on screen",
      app: APP,
      location: { kind: "discussion", id: "on-alpha" },
      want: "alpha",
    },
    {
      name: "the board of the last discussion, for a task without a board",
      app: APP,
      location: { kind: "task", id: "no-board" },
      want: "gamma",
    },
    {
      name: "the board of the last discussion, elsewhere",
      app: APP,
      location: HOME,
      want: "gamma",
    },
    {
      name: "the first board, when the last discussion's board was removed",
      app: { ...APP, boards: [ALPHA, BETA] },
      location: HOME,
      want: "alpha",
    },
    {
      name: "the first board, without a discussion",
      app: { ...APP, discussions: [] },
      location: { kind: "reviews" },
      want: "alpha",
    },
    {
      name: "nothing without a board",
      app: makeState({ boards: [] }),
      location: HOME,
      want: null,
    },
  ];

  it.each(cases)("opens for $name", ({ app, location, want }) => {
    expect(discussionBoard(app, location)).toBe(want);
  });

  it("opens for nothing before the state arrives", () => {
    expect(discussionBoard(null, HOME)).toBeNull();
  });
});
