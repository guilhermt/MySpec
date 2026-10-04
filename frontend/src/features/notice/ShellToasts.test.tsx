import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShellToasts } from "@/features/notice/ShellToasts";
import { type Toast, useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeCloseResult,
  makeRepository,
  makeReviewPass,
  makeState,
} from "@/test/wails-mock";

const TOAST: Toast = {
  id: "task-1",
  kind: "task",
  task: makeArchivedTask({ id: "task-1", name: "add-login" }),
};

function taskToast(n: string): Toast {
  return {
    id: `task-${n}`,
    kind: "task",
    task: makeArchivedTask({ id: `task-${n}`, name: n }),
  };
}

describe("ShellToasts", () => {
  it("says what the store announces", () => {
    renderWithStore(<ShellToasts />);

    act(() => useAppStore.getState().announce("Nothing else needs you now."));

    expect(screen.getByRole("status")).toHaveTextContent("Nothing else needs you now.");
  });

  it("says nothing before an announcement", () => {
    renderWithStore(<ShellToasts />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows the toast of a task that was archived, with how its closing went", () => {
    const close = makeCloseResult({ closedAt: new Date().toISOString() });
    const task = makeArchivedTask({ id: "task-1", name: "add-login", close });
    renderWithStore(<ShellToasts />, { ui: { toasts: [{ id: "task-1", kind: "task", task }] } });

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("“add-login” was archived");
    expect(region).toHaveTextContent(/Closed at \d\d:\d\d/);
  });

  it("shows the toast of a task archived without a result of its closing, with no detail", () => {
    renderWithStore(<ShellToasts />, { ui: { toasts: [TOAST] } });

    expect(screen.getByRole("status")).not.toHaveTextContent("Closed");
  });

  it("shows the toast of a review that was merged, with its last pass", () => {
    const publishedAt = new Date().toISOString();
    const review = makeArchivedReview({
      id: "review-1",
      outcome: "merged",
      passes: [makeReviewPass({ pass: 2, published: true, publishedAt })],
    });
    renderWithStore(<ShellToasts />, {
      ui: { toasts: [{ id: "review-1", kind: "review", review }] },
    });

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("web#31 was merged, and its review ended");
    expect(region).toHaveTextContent(/Pass 2 was published at \d\d:\d\d/);
  });

  it("shows the toast of a discussion that was archived, with what it published", () => {
    const discussion = makeArchivedDiscussion({ id: "discussion-1", publishedCount: 3 });
    renderWithStore(<ShellToasts />, {
      ui: { toasts: [{ id: "discussion-1", kind: "discussion", discussion }] },
    });

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("“Invoices” was archived");
    expect(region).toHaveTextContent("3 cards published");
  });

  it.each<[Toast["kind"], Toast]>([
    ["task", TOAST],
    ["review", { id: "review-1", kind: "review", review: makeArchivedReview({ id: "review-1" }) }],
    [
      "discussion",
      {
        id: "discussion-1",
        kind: "discussion",
        discussion: makeArchivedDiscussion({ id: "discussion-1" }),
      },
    ],
  ])("opens the History on the %s from its toast, which leaves", async (kind, toast) => {
    const { user } = renderWithStore(<ShellToasts />, {
      state: makeState({ repositories: [makeRepository()] }),
      ui: { toasts: [toast] },
    });

    await user.click(screen.getByRole("button", { name: "Open in History" }));

    expect(useAppStore.getState().location).toEqual({
      kind: "history",
      fresh: { kind, id: toast.id },
    });
    expect(useAppStore.getState().toasts).toEqual([]);
  });

  it("shows three toasts at most, letting the oldest go", () => {
    const toasts = ["1", "2", "3"].map(taskToast);
    renderWithStore(<ShellToasts />, { ui: { toasts } });

    act(() => useAppStore.setState({ toasts: [...toasts.slice(1), taskToast("4")] }));

    expect(screen.queryByText("“1” was archived")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Dismiss" })).toHaveLength(3);
  });

  it("takes the toast off on Dismiss", async () => {
    const { user } = renderWithStore(<ShellToasts />, { ui: { toasts: [TOAST] } });

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(useAppStore.getState().toasts).toEqual([]);
  });
});
