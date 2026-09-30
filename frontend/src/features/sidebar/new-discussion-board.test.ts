import { describe, expect, it } from "vitest";
import { discussionTarget } from "@/features/sidebar/new-discussion-board";
import { HOME, type Location } from "@/lib/locations";
import type { State } from "@/lib/wails";
import {
  makeArchivedTask,
  makeBoard,
  makeDiscussion,
  makeRepository,
  makeState,
  makeTask,
} from "@/test/wails-mock";

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
    makeDiscussion({ id: "on-alpha", boardId: "alpha", createdAt: "2026-09-20T10:00:00Z" }),
    makeDiscussion({ id: "on-gamma", boardId: "gamma", createdAt: "2026-09-21T10:00:00Z" }),
  ],
});

describe("discussionTarget", () => {
  const UNREAD = makeBoard({ id: "unread", title: "Unread", readAt: "" });
  const open = (boardId: string, askBoard: boolean) => ({ kind: "open", boardId, askBoard });

  const cases: { name: string; app: State | null; location: Location; want: unknown }[] = [
    {
      name: "no board",
      app: makeState({ boards: [] }),
      location: HOME,
      want: { kind: "disabled", reason: "Add a board to discuss its cards." },
    },
    {
      name: "the state not arrived",
      app: null,
      location: HOME,
      want: { kind: "disabled", reason: "Add a board to discuss its cards." },
    },
    {
      name: "no board read, even on a board's own place",
      app: makeState({ boards: [UNREAD] }),
      location: { kind: "board", id: "unread" },
      want: { kind: "disabled", reason: "The board hasn't been read yet." },
    },
    {
      name: "a place with a board: a board, a task, a discussion",
      app: APP,
      location: { kind: "task", id: "on-beta" },
      want: open("beta", false),
    },
    {
      name: "the board on screen",
      app: APP,
      location: { kind: "board", id: "alpha" },
      want: open("alpha", false),
    },
    {
      name: "the board of the discussion on screen",
      app: APP,
      location: { kind: "discussion", id: "on-alpha" },
      want: open("alpha", false),
    },
    {
      name: "a single board, from Home",
      app: makeState({ boards: [ALPHA] }),
      location: HOME,
      want: open("alpha", false),
    },
    {
      name: "Home with several boards",
      app: APP,
      location: HOME,
      want: open("gamma", true),
    },
    {
      name: "Reviews with several boards",
      app: APP,
      location: { kind: "reviews" },
      want: open("gamma", true),
    },
    {
      name: "History with several boards",
      app: APP,
      location: { kind: "history" },
      want: open("gamma", true),
    },
    {
      name: "Settings with several boards",
      app: APP,
      location: { kind: "settings", section: "boards" },
      want: open("gamma", true),
    },
    {
      name: "a task of a repository without a board",
      app: APP,
      location: { kind: "task", id: "no-board" },
      want: open("gamma", true),
    },
    {
      name: "an archived task",
      app: { ...APP, history: [makeArchivedTask({ id: "old" })] },
      location: { kind: "archived-task", id: "old" },
      want: open("gamma", true),
    },
    {
      name: "the first read board, when the last used was never read",
      app: {
        ...APP,
        boards: [UNREAD, ALPHA, BETA],
        discussions: [makeDiscussion({ boardId: "unread" })],
      },
      location: HOME,
      want: open("alpha", true),
    },
  ];

  it.each(cases)("is $name", ({ app, location, want }) => {
    expect(discussionTarget(app, location)).toEqual(want);
  });
});
