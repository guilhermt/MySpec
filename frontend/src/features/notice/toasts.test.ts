import { describe, expect, it } from "vitest";
import { ICONS } from "@/components/system/icons";
import { toastOf } from "@/features/notice/toasts";
import type { Toast } from "@/store/app-store";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeCloseResult,
  makeReviewPass,
} from "@/test/wails-mock";

const NOW = new Date(2026, 8, 24, 15, 10).getTime();
const at = (hour: number, minute: number) => new Date(2026, 8, 24, hour, minute).toISOString();

function taskToast(close: ReturnType<typeof makeCloseResult> | null): Toast {
  return {
    id: "task-1",
    kind: "task",
    task: makeArchivedTask({ name: "Idempotency keys for payment intents", close }),
  };
}

function reviewToast(overrides: Parameters<typeof makeArchivedReview>[0]): Toast {
  return {
    id: "review-1",
    kind: "review",
    review: makeArchivedReview({ repository: "acme/web", number: 2288, ...overrides }),
  };
}

const DONE = { outcome: "done", reason: "", detail: "" };

describe("toastOf a task", () => {
  const closedAt = at(15, 2);

  it("says when it was closed", () => {
    expect(toastOf(taskToast(makeCloseResult({ closedAt })), NOW)).toEqual({
      icon: ICONS.archive,
      text: "“Idempotency keys for payment intents” was archived",
      detail: "Closed at 15:02",
    });
  });

  it("adds the line of the part of the closing that asks for attention", () => {
    const close = makeCloseResult({
      closedAt,
      base: { outcome: "skipped", reason: "not_checked_out", detail: "" },
    });

    expect(toastOf(taskToast(close), NOW).detail).toBe(
      "Closed at 15:02 · dev not updated: another branch is checked out",
    );
  });

  it.each([
    ["worktree", { worktree: { outcome: "skipped", reason: "missing", detail: "" } }],
    ["base", { base: { outcome: "skipped", reason: "up_to_date", detail: "" } }],
  ])(
    "leaves out what doesn't ask for attention: the %s already as it should be",
    (_part, parts) => {
      const close = makeCloseResult({
        closedAt,
        worktree: DONE,
        branch: DONE,
        base: DONE,
        ...parts,
      });

      expect(toastOf(taskToast(close), NOW).detail).toBe("Closed at 15:02");
    },
  );

  it("has no detail without the result of its closing", () => {
    expect(toastOf(taskToast(null), NOW).detail).toBeNull();
  });
});

describe("toastOf a review", () => {
  it("tells a merged review and its last published pass", () => {
    const toast = reviewToast({
      outcome: "merged",
      passes: [
        makeReviewPass({ pass: 1, published: true, publishedAt: at(11, 0) }),
        makeReviewPass({ pass: 2, published: true, publishedAt: at(13, 10) }),
        makeReviewPass({ pass: 3, published: false }),
      ],
    });

    expect(toastOf(toast, NOW)).toEqual({
      icon: ICONS.merge,
      text: "web#2288 was merged, and its review ended",
      detail: "Pass 2 was published at 13:10",
    });
  });

  it("tells a review closed without a merge", () => {
    expect(toastOf(reviewToast({ outcome: "closed", passes: [] }), NOW).text).toBe(
      "web#2288 was closed without a merge, and its review ended",
    );
  });

  it("tells the findings of the last pass an Apply review sent to the agent", () => {
    const toast = reviewToast({
      mode: "apply",
      passes: [makeReviewPass({ pass: 1, sent: true, sentAt: at(13, 41) })],
    });

    expect(toastOf(toast, NOW).detail).toBe("The findings of pass 1 went to the agent at 13:41");
  });

  it("says no pass went out, and leaves out a time that wasn't kept", () => {
    expect(
      toastOf(reviewToast({ passes: [makeReviewPass({ published: false })] }), NOW).detail,
    ).toBe("No pass was published");
    expect(
      toastOf(reviewToast({ passes: [makeReviewPass({ published: true, publishedAt: "" })] }), NOW)
        .detail,
    ).toBe("Pass 1 was published");
  });
});

describe("toastOf a discussion", () => {
  it.each([
    [0, "Nothing published"],
    [1, "1 card published"],
    [3, "3 cards published"],
  ])("says what %i published", (publishedCount, detail) => {
    const discussion = makeArchivedDiscussion({
      title: "Usage alerts at 80% of the plan",
      publishedCount,
    });

    expect(toastOf({ id: "d", kind: "discussion", discussion }, NOW)).toEqual({
      icon: ICONS.archive,
      text: "“Usage alerts at 80% of the plan” was archived",
      detail,
    });
  });
});
