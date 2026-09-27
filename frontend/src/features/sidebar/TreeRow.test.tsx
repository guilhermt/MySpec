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
const measure = vi.hoisted(() => ({ fits: true }));
vi.mock("@/features/sidebar/useFits", () => ({ useFits: () => measure.fits }));

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

function renderRow(row: ItemRow, props: Partial<TreeRowProps> = {}) {
  return renderWithStore(
    <TreeRow
      row={row}
      level={2}
      selected={false}
      isNext={false}
      flash={null}
      narrow={false}
      tabIndex={0}
      {...props}
    />,
  );
}

afterEach(() => {
  measure.fits = true;
});

describe("TreeRow", () => {
  it.each<[string, ItemRow, string]>([
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
    ],
    [
      "a task ready to close",
      rowOf(
        task({
          stage: "closing",
          situations: [
            makeSituation({ kind: "close", group: "closing", startedAt: TWO_HOURS_AGO }),
          ],
        }),
      ),
      "close",
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
    ],
    ["the app preparing a step", rowOf(task({ steps: stepAt("preparing") })), "app"],
    [
      "a pull request on GitHub",
      rowOf(
        task({
          stage: "pr",
          pr: makePullRequest({ status: "waiting_checks", prNumber: 1279 }),
        }),
      ),
      "github",
    ],
    [
      "a paused session",
      rowOf(task({ steps: stepAt("implementing"), sessionStatus: "paused" })),
      "paused",
    ],
    ["an idle task", rowOf(task({ stage: "prd", steps: [], currentStep: 0 })), "idle"],
    [
      "a quiet discussion",
      discussionRow(makeDiscussion({ sessionStatus: "waiting" }), NOW),
      "idle",
    ],
    [
      "a published discussion",
      discussionRow(makeDiscussion({ status: "published", cards: [] }), NOW),
      "archive",
    ],
  ])("draws %s under its whole sentence", (_, row, tone) => {
    renderRow(row);

    const item = screen.getByRole("treeitem", { name: row.label });
    expect(item).toHaveAttribute("data-tone", tone);
    expect(row.tone).toBe(tone);
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

    expect(screen.getByRole("treeitem")).toHaveClass(
      "shadow-[inset_var(--error-rail)_0_0_var(--state-error)]",
    );
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

    expect(screen.getByText("Reading go.mod", { selector: "span.font-mono" })).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "40");
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
