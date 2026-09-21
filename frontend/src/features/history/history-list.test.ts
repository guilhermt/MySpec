import { describe, expect, it } from "vitest";
import { historyEntries } from "@/features/history/history-list";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeState,
} from "@/test/wails-mock";

const LOGIN = makeArchivedTask({
  id: "task-login",
  name: "add-login",
  archivedAt: "2026-09-08T10:00:00Z",
});
const HEADER = makeArchivedTask({
  id: "task-header",
  name: "fix-header",
  repositoryId: "repo-2",
  repository: "dev/api",
  archivedAt: "2026-09-02T10:00:00Z",
});
const REVIEW = makeArchivedReview({
  id: "review-31",
  number: 31,
  title: "Cache the sessions",
  archivedAt: "2026-09-05T10:00:00Z",
});
const DISCUSSION = makeArchivedDiscussion({
  id: "discussion-1",
  title: "The invoices",
  repositoryIds: ["repo-2"],
  archivedAt: "2026-09-06T10:00:00Z",
});
const APP = makeState({
  history: [LOGIN, HEADER],
  reviewHistory: [REVIEW],
  discussionHistory: [DISCUSSION],
});

function ids(query: string, filter: string): string[] {
  return historyEntries(APP, query, filter).map((entry) => entry.id);
}

describe("historyEntries", () => {
  it("joins the tasks, the reviews and the discussions, the last to end first", () => {
    expect(ids("", "")).toEqual(["task-login", "discussion-1", "review-31", "task-header"]);
    expect(ids("   ", "")).toEqual(["task-login", "discussion-1", "review-31", "task-header"]);
  });

  it("tells a task from a review and from a discussion", () => {
    const [task, discussion, review] = historyEntries(APP, "", "");

    expect(task).toEqual({ kind: "task", id: LOGIN.id, archivedAt: LOGIN.archivedAt, task: LOGIN });
    expect(review).toEqual({
      kind: "review",
      id: REVIEW.id,
      archivedAt: REVIEW.archivedAt,
      review: REVIEW,
    });
    expect(discussion).toEqual({
      kind: "discussion",
      id: DISCUSSION.id,
      archivedAt: DISCUSSION.archivedAt,
      discussion: DISCUSSION,
    });
  });

  it("matches the title of a discussion", () => {
    expect(ids("invoices", "")).toEqual(["discussion-1"]);
  });

  it("matches part of the name of a task, whatever the case", () => {
    expect(ids("LOG", "")).toEqual(["task-login"]);
    expect(ids(" header ", "")).toEqual(["task-header"]);
  });

  it("matches the title of a review, or its #number", () => {
    expect(ids("sessions", "")).toEqual(["review-31"]);
    expect(ids("#31", "")).toEqual(["review-31"]);
    expect(ids("31", "")).toEqual(["review-31"]);
  });

  it("keeps the tasks, the reviews and the discussions of the repository of the filter", () => {
    expect(ids("", "repo-1")).toEqual(["task-login", "review-31"]);
    expect(ids("", "repo-2")).toEqual(["discussion-1", "task-header"]);
    expect(ids("sessions", "repo-2")).toEqual([]);
  });

  it("answers with nothing when nothing matches, or before the first snapshot", () => {
    expect(ids("payments", "")).toEqual([]);
    expect(historyEntries(null, "", "")).toEqual([]);
  });
});
