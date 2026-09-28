import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discussionRow, type ItemRow, reviewRow, taskRow } from "@/features/sidebar/sidebar-tree";
import { TreeRow, type TreeRowProps } from "@/features/sidebar/TreeRow";
import type { TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeDiscussion,
  makePullRequest,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeStep,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

// The meta that does not fit is a layout jsdom cannot make: the measure is switched by hand.
// Each drawing of a row measures, so the count of measures tells whether it drew again.
const measure = vi.hoisted(() => ({ fits: true, count: 0 }));
vi.mock("@/features/sidebar/useFits", () => ({
  useFits: () => {
    measure.count += 1;
    return measure.fits;
  },
}));

const NOW = Date.parse("2026-09-05T12:00:00Z");
const TWO_HOURS_AGO = "2026-09-05T10:00:00Z";
const THREE_MINUTES_AGO = "2026-09-05T11:57:00Z";
const STEPS = [1, 2, 3, 4, 5, 6, 7].map((number) => makeStep({ number, status: "done" }));

function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return makeTask({
    stage: "implementation",
    steps: STEPS,
    currentStep: 3,
    card: makeTaskCard({ number: 42 }),
    ...overrides,
  });
}

const stepAt = (status: string) =>
  STEPS.map((step) => (step.number === 3 ? { ...step, status } : step));

const rowOf = (summary: TaskSummary) => taskRow(makeState(), summary, NOW);

function rowElement(row: ItemRow, props: Partial<TreeRowProps> = {}) {
  return (
    <TreeRow
      row={row}
      level={2}
      selected={false}
      isNext={false}
      flash={null}
      narrow={false}
      tabIndex={0}
      {...props}
    />
  );
}

function renderRow(row: ItemRow, props: Partial<TreeRowProps> = {}) {
  return renderWithStore(rowElement(row, props));
}

afterEach(() => {
  measure.fits = true;
  measure.count = 0;
});

describe("TreeRow", () => {
  it.each<[string, ItemRow, string, string]>([
    [
      "an error",
      rowOf(
        task({
          situations: [
            makeSituation({
              kind: "session_error",
              group: "error",
              place: { kind: "step", stage: "", step: 3 },
              startedAt: TWO_HOURS_AGO,
            }),
          ],
        }),
      ),
      "error",
      "task add-login. error: Session error · Implementer · Step 3/7, for 2 hours. Step 3/7. web#42.",
    ],
    [
      "a question",
      rowOf(
        task({
          situations: [
            makeSituation({
              kind: "question",
              place: { kind: "step", stage: "", step: 3 },
              startedAt: TWO_HOURS_AGO,
            }),
          ],
        }),
      ),
      "wait",
      "task add-login. waiting for you: Question · Implementer · Step 3/7, for 2 hours. Step 3/7. web#42.",
    ],
    [
      "a task ready to close",
      rowOf(
        task({
          stage: "pr",
          pr: makePullRequest({ status: "done", prNumber: 1279, prState: "MERGED" }),
          situations: [
            makeSituation({
              kind: "merge",
              group: "closing",
              form: "close",
              place: { kind: "pr", stage: "", step: 0 },
              startedAt: TWO_HOURS_AGO,
            }),
          ],
        }),
      ),
      "close",
      "task add-login. ready to close: Ready to close · PR #1279 merged, for 2 hours. PR review. web#42.",
    ],
    [
      "an agent working",
      rowOf(
        task({
          steps: stepAt("implementing"),
          sessionStatus: "working",
          turnRunning: true,
          turnStartedAt: THREE_MINUTES_AGO,
          actionLabel: "Reading",
          actionTarget: "go.mod",
        }),
      ),
      "agent",
      "task add-login. agent working, Step 3/7. Implementer working for 3 minutes: Reading go.mod. context 0% used. web#42.",
    ],
    [
      "the app preparing a step",
      rowOf(task({ steps: stepAt("preparing") })),
      "app",
      "task add-login. working, Step 3/7 · preparing the worktree. web#42.",
    ],
    [
      "a pull request on GitHub",
      rowOf(
        task({
          stage: "pr",
          pr: makePullRequest({
            status: "waiting_checks",
            prNumber: 1279,
            checkedAt: "2026-09-05T11:59:00Z",
          }),
        }),
      ),
      "github",
      "task add-login. waiting on GitHub, PR review · waiting for checks. web#42.",
    ],
    [
      "a pull request GitHub has not reported yet",
      rowOf(
        task({
          stage: "pr",
          pr: makePullRequest({ status: "waiting_checks", prNumber: 1279 }),
        }),
      ),
      "github",
      "task add-login. waiting on GitHub, PR review · checking GitHub. web#42.",
    ],
    [
      "a paused session",
      rowOf(task({ steps: stepAt("implementing"), sessionStatus: "paused" })),
      "paused",
      "task add-login. paused, Paused · Step 3/7. web#42.",
    ],
    [
      "an idle task",
      rowOf(task({ stage: "prd", steps: [], currentStep: 0 })),
      "idle",
      "task add-login. idle, PRD. web#42.",
    ],
    [
      "a quiet discussion",
      discussionRow(makeDiscussion({ sessionStatus: "waiting" }), NOW),
      "idle",
      "discussion Invoices. idle, Discussing. #12.",
    ],
    [
      "a published discussion",
      discussionRow(makeDiscussion({ status: "published", cards: [] }), NOW),
      "archive",
      "discussion Invoices. ready to close, Ready to archive.",
    ],
  ])("draws %s under its whole sentence", (_, row, tone, sentence) => {
    renderRow(row);

    expect(screen.getByRole("treeitem", { name: sentence })).toHaveAttribute("data-tone", tone);
  });

  it("reads a waiting task as one sentence", () => {
    renderRow(
      rowOf(
        task({
          situations: [
            makeSituation({
              kind: "question",
              place: { kind: "step", stage: "", step: 3 },
              startedAt: TWO_HOURS_AGO,
            }),
          ],
        }),
      ),
    );

    expect(
      screen.getByRole("treeitem", {
        name: "task add-login. waiting for you: Question · Implementer · Step 3/7, for 2 hours. Step 3/7. web#42.",
      }),
    ).toBeInTheDocument();
  });

  it("shows the long line and the meta when they fit", () => {
    renderRow(rowOf(task({ steps: stepAt("preparing") })));

    expect(
      screen.getByText("Step 3/7 · preparing the worktree", { selector: "span.truncate" }),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-meta]")).toHaveTextContent("web#42");
  });

  it("takes the short line when the sidebar is narrow, without the meta", () => {
    renderRow(rowOf(task({ steps: stepAt("preparing") })), { narrow: true });

    expect(
      screen.getByText("Step 3/7 · preparing", { selector: "span.truncate" }),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-meta]")).toBeNull();
  });

  it("leaves the meta out, and tells it in the tooltip, when it does not fit beside the name", async () => {
    measure.fits = false;
    const { user } = renderRow(rowOf(task({ steps: stepAt("preparing") })));

    expect(document.querySelector("[data-meta]")).toBeNull();
    await user.hover(screen.getByRole("treeitem"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("add-login · web#42");
  });

  it("tells the meta in the tooltip on the next row, where the Ctrl J key takes its place", async () => {
    const { user } = renderRow(rowOf(task({ steps: stepAt("preparing") })), { isNext: true });

    await user.hover(screen.getByRole("treeitem"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^add-login · web#42$/);
  });

  it("tells only the name in the tooltip when the meta is on the line", async () => {
    const { user } = renderRow(rowOf(task({ steps: stepAt("preparing") })));

    await user.hover(screen.getByRole("treeitem"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^add-login$/);
  });

  it("tells only the name in the tooltip of an item without a meta", async () => {
    measure.fits = false;
    const { user } = renderRow(
      discussionRow(makeDiscussion({ sessionStatus: "waiting", cards: [] }), NOW),
    );

    await user.hover(screen.getByRole("treeitem"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Invoices$/);
  });

  it("does not draw again for a new summary that shows the same", () => {
    const { rerender } = renderRow(rowOf(task({ steps: stepAt("preparing") })));
    const drawn = measure.count;

    rerender(rowElement(rowOf(task({ steps: stepAt("preparing") }))));

    expect(measure.count).toBe(drawn);
  });

  it("draws again when what it shows changes", () => {
    const { rerender } = renderRow(rowOf(task({ steps: stepAt("preparing") })));
    const drawn = measure.count;

    rerender(rowElement(rowOf(task({ steps: stepAt("committing") }))));

    expect(measure.count).toBeGreaterThan(drawn);
    expect(
      screen.getByText("Step 3/7 · committing", { selector: "span.truncate" }),
    ).toBeInTheDocument();
  });

  it("marks the open row as the page on screen", () => {
    renderRow(rowOf(task()), { selected: true });

    const item = screen.getByRole("treeitem", { name: /^task add-login\./ });
    expect(item).toHaveAttribute("aria-current", "page");
    expect(item).toHaveAttribute("aria-selected", "true");
  });

  it("carries the Ctrl J key and its sentence on the next row", () => {
    const row = rowOf(task());
    renderRow(row, { isNext: true });

    const item = screen.getByRole("treeitem", { name: `${row.label} Ctrl+J opens this next.` });
    expect(within(item).getByText("Ctrl J")).toBeInTheDocument();
    expect(document.querySelector("[data-meta]")).toBeNull();
  });

  it("draws the error rail on a row in error", () => {
    renderRow(
      rowOf(
        task({
          situations: [
            makeSituation({ kind: "session_error", group: "error", startedAt: TWO_HOURS_AGO }),
          ],
        }),
      ),
    );

    expect(screen.getByRole("treeitem")).toHaveClass("error-rail-bar");
  });

  it("blinks in the veil it is given", () => {
    renderRow(rowOf(task()), { flash: "wait" });

    expect(screen.getByRole("treeitem")).toHaveAttribute("data-flash", "wait");
  });

  it("draws what the agent does on line 3, with the context it used", () => {
    renderRow(
      rowOf(
        task({
          steps: stepAt("implementing"),
          sessionStatus: "working",
          turnRunning: true,
          turnStartedAt: THREE_MINUTES_AGO,
          contextPercent: 40,
          actionLabel: "Reading",
          actionTarget: "go.mod",
        }),
      ),
    );

    expect(
      screen.getByText(
        (_, element) =>
          element?.matches("span.font-mono") === true &&
          element.textContent?.startsWith("Reading go.mod") === true,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "40");
  });

  it("shimmers line 2 while GitHub has not reported the pull request", () => {
    renderRow(
      rowOf(
        task({ stage: "pr", pr: makePullRequest({ status: "waiting_checks", prNumber: 1279 }) }),
      ),
    );

    expect(
      screen.getByText("PR review · checking GitHub", { selector: ".shimmer-text" }),
    ).toBeInTheDocument();
  });

  it("opens its item on click", async () => {
    const { user } = renderRow(rowOf(task()));

    await user.click(screen.getByRole("treeitem"));

    expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });
  });

  it("opens a review on click", async () => {
    const review = makeReviewSummary({ passes: [makeReviewPass({ pass: 1 })] });
    const { user } = renderRow(reviewRow(review, NOW));

    await user.click(screen.getByRole("treeitem"));

    expect(useAppStore.getState().location).toEqual({ kind: "review", id: review.id });
  });
});
