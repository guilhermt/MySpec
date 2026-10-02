import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { TaskView } from "@/features/task/TaskView";
import { api, type PRReport, type PullRequest, type TaskSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeEntry,
  makePRReport,
  makePullRequest,
  makeReviewFinding,
  makeSituation,
  makeState,
  makeTask,
  makeTaskConversation,
  makeTranscript,
} from "@/test/wails-mock";

const DECIDE = makeSituation({
  kind: "findings",
  form: "decide",
  taskId: "task-1",
  place: { kind: "pr", stage: "", step: 0 },
});

// A pass with three findings, the middle one decided, the last one general.
const FINDINGS = [
  makeReviewFinding({ number: 1, title: "First" }),
  makeReviewFinding({ number: 2, title: "Second", decision: "approved" }),
  makeReviewFinding({ number: 3, title: "Third", path: "", line: 0 }),
];

function taskOf(report: Partial<PRReport> = {}, pr: Partial<PullRequest> = {}): TaskSummary {
  return makeTask({
    stage: "pr",
    worktreePath: "/work/add-login",
    conversations: [
      makeTaskConversation({ stage: "pr" }),
      makeTaskConversation({ stage: "pr_review" }),
    ],
    situations: [DECIDE],
    pr: makePullRequest({
      status: "awaiting_decision",
      prNumber: 1284,
      prState: "open",
      sessionStage: "pr_review",
      sessionStatus: "waiting",
      currentPass: 1,
      reports: [makePRReport({ findings: FINDINGS, ...report })],
      ...pr,
    }),
  });
}

function screenOf(task: TaskSummary = taskOf()) {
  return renderWithStore(<WithShortcuts />, {
    state: makeState({ tasks: [task] }),
    ui: { location: { kind: "task", id: "task-1" } },
  });
}

// WithShortcuts is the task screen with the shortcuts of the app around it.
function WithShortcuts() {
  useGlobalShortcuts();
  return <TaskView taskId="task-1" />;
}

const finding = (number: number) =>
  screen.getByRole("group", { name: new RegExp(`^Finding ${number} of `) });

const composer = () => screen.getByRole("textbox", { name: /Message|Reply|PR agent/i });

describe("TaskView, the keys of the findings", () => {
  it("goes to the next finding to decide with Alt+↓ from the composer, and wraps", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    composer().focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(finding(1)).toHaveFocus();

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(finding(3)).toHaveFocus();

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(finding(1)).toHaveFocus();
  });

  it("goes to the previous finding to decide with Alt+↑, and wraps", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(finding(3)).toHaveFocus();

    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(finding(1)).toHaveFocus();
  });

  it("stays where it is when nothing is left to decide", async () => {
    const { user } = screenOf(
      taskOf({
        findings: FINDINGS.map((each) => makeReviewFinding({ ...each, decision: "approved" })),
      }),
    );
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(2).focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");

    expect(finding(2)).toHaveFocus();
  });

  it("does nothing without a card of findings on screen", async () => {
    const { user } = screenOf(
      taskOf({ structured: false, recorded: false, findings: [] }, { status: "reviewing" }),
    );
    await screen.findByRole("feed");

    composer().focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");

    expect(composer()).toHaveFocus();
  });

  it("does nothing for the card of a pass already sent", async () => {
    const { user } = screenOf(taskOf({ sentAt: "2026-09-27T17:36:00Z" }, { status: "committing" }));
    await screen.findByRole("feed");

    composer().focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");

    expect(composer()).toHaveFocus();
  });

  it("takes the focus to the next finding to decide from the bar, with Next to decide", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    await user.click(screen.getByRole("button", { name: "Next to decide" }));

    expect(finding(1)).toHaveFocus();
  });
});

describe("TaskView, the keys of a finding on the screen", () => {
  it("decides with A and D and takes the focus to the next finding to decide", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("a");

    expect(api.decidePRFinding).toHaveBeenCalledWith("task-1", 1, 1, "approved");
    expect(finding(3)).toHaveFocus();

    await user.keyboard("d");

    expect(api.decidePRFinding).toHaveBeenLastCalledWith("task-1", 1, 3, "discarded");
  });

  it("takes a decision back with the same key and stays where it is", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(2).focus();
    await user.keyboard("a");

    expect(api.decidePRFinding).toHaveBeenCalledWith("task-1", 1, 2, "");
    expect(finding(2)).toHaveFocus();
  });

  it("ignores the repeat of a key held down", async () => {
    screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    fireEvent.keyDown(finding(1), { key: "a", repeat: true });

    expect(api.decidePRFinding).not.toHaveBeenCalled();
    expect(finding(1)).toHaveFocus();
  });

  it("keeps the focus where it is when nothing is left to decide", async () => {
    const { user } = screenOf(
      taskOf({ findings: FINDINGS.map((each) => ({ ...each, decision: "discarded" })) }),
    );
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(3).focus();
    await user.keyboard("d");

    expect(api.decidePRFinding).toHaveBeenCalledWith("task-1", 1, 3, "");
    expect(finding(3)).toHaveFocus();
  });

  it("walks the findings with ↑ and ↓, and leaves the card at its ends", async () => {
    const marker = makeEntry("marker");
    vi.mocked(api.getTranscript).mockResolvedValueOnce(
      makeTranscript({
        taskId: "task-1",
        stage: "pr_review",
        entries: [
          marker.marker === null
            ? marker
            : { ...marker, marker: { ...marker.marker, type: "pr_review_written", pass: 1 } },
          makeEntry("assistant"),
        ],
      }),
    );
    const { user } = screenOf();
    const card = await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(2).focus();
    await user.keyboard("{ArrowDown}");
    expect(finding(3)).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(finding(1)).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toHaveTextContent("Review 1 written");
    expect(card.contains(document.activeElement)).toBe(false);

    await user.keyboard("{ArrowDown}");
    expect(finding(1)).toHaveFocus();
  });

  it("walks the conversation with Home, End and the pages, leaving the card", async () => {
    const entry = (type: string) => {
      const marker = makeEntry("marker");
      return marker.marker === null
        ? marker
        : { ...marker, marker: { ...marker.marker, type, pass: 1 } };
    };
    vi.mocked(api.getTranscript).mockResolvedValueOnce(
      makeTranscript({
        taskId: "task-1",
        stage: "pr_review",
        entries: [entry("pr_review_written"), makeEntry("assistant")],
      }),
    );
    const { user } = screenOf();
    const card = await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(2).focus();
    await user.keyboard("{Home}");
    expect(document.activeElement).toHaveTextContent("Review 1 written");

    expect(card.contains(document.activeElement)).toBe(false);

    finding(2).focus();
    await user.keyboard("{End}");
    expect(document.activeElement).not.toHaveTextContent("Review 1 written");
    expect(screen.getByRole("feed").contains(document.activeElement)).toBe(true);

    finding(2).focus();
    await user.keyboard("{PageUp}");
    expect(document.activeElement).toHaveTextContent("Review 1 written");

    finding(2).focus();
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("feed").contains(document.activeElement)).toBe(true);
  });

  it("is one stop of Tab, the finding, never the card around it", async () => {
    const { user } = screenOf();
    const card = await screen.findByRole("group", { name: "Findings of pass 1" });

    expect(card).toHaveAttribute("tabindex", "-1");
    finding(1).focus();
    await user.tab({ shift: true });
    expect(card.contains(document.activeElement)).toBe(false);
    await user.tab();
    expect(finding(1)).toHaveFocus();
  });

  it("edits with E, and gives the focus back to the finding with Esc and with Done", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("e");
    expect(screen.getByRole("textbox", { name: "Text of finding 1" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Text of finding 1" })).not.toBeInTheDocument();
    expect(finding(1)).toHaveFocus();

    await user.keyboard("e");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(finding(1)).toHaveFocus();
  });

  it("opens the line on GitHub with O and in the editor with Ctrl+E, not the worktree", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("o");
    await user.keyboard("{Control>}e{/Control}");

    expect(api.openExternal).toHaveBeenCalledWith(FINDINGS[0]?.lineUrl);
    expect(api.openPRFindingInEditor).toHaveBeenCalledWith("task-1", 1, 1);
    expect(api.openInEditor).not.toHaveBeenCalled();
  });

  it("opens the worktree with Ctrl+E outside a finding, and on a general finding", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    composer().focus();
    await user.keyboard("{Control>}e{/Control}");
    expect(api.openInEditor).toHaveBeenCalledTimes(1);

    finding(3).focus();
    await user.keyboard("{Control>}e{/Control}");

    expect(api.openInEditor).toHaveBeenCalledTimes(2);
    expect(api.openPRFindingInEditor).not.toHaveBeenCalled();
  });

  it("leaves a finding of a pass behind only O and Ctrl+E", async () => {
    const { user } = screenOf(
      taskOf(
        { findings: FINDINGS.map((each) => ({ ...each, decision: "discarded" })) },
        { status: "merged", prState: "merged" },
      ),
    );
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("a");
    await user.keyboard("d");
    await user.keyboard("e");
    expect(api.decidePRFinding).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Text of finding 1" })).not.toBeInTheDocument();

    await user.keyboard("o");
    await user.keyboard("{Control>}e{/Control}");
    expect(api.openExternal).toHaveBeenCalledWith(FINDINGS[0]?.lineUrl);
    expect(api.openPRFindingInEditor).toHaveBeenCalledWith("task-1", 1, 1);
  });

  it("goes along 29 findings, deciding each one and rolling the focus to the next", async () => {
    const many = Array.from({ length: 29 }, (_, index) =>
      makeReviewFinding({ number: index + 1, title: `Finding ${index + 1}`, line: index + 1 }),
    );
    const { user } = screenOf(taskOf({ findings: many }));
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    for (let number = 1; number <= 28; number++) {
      await user.keyboard("a");
      expect(finding(number + 1)).toHaveFocus();
    }

    expect(api.decidePRFinding).toHaveBeenCalledTimes(28);
    expect(api.decidePRFinding).toHaveBeenLastCalledWith("task-1", 1, 28, "approved");
    // One stop of Tab in the card, on the finding the focus sits in.
    const stops = screen
      .getAllByRole("group", { name: /^Finding \d+ of / })
      .filter((each) => each.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(finding(29));
  }, 30_000);
});

describe("TaskView, the bar of the findings", () => {
  it("approves the rest with the button, which has no key", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    const button = screen.getByRole("button", { name: "Approve the rest" });
    expect(button).not.toHaveTextContent(/Ctrl|Alt/);
    await user.click(button);

    expect(api.approveRestOfPRFindings).toHaveBeenCalledWith("task-1", 1);
  });

  // applyApproved is the state:changed of the rest approved: every finding approved, the bar applying.
  const applyApproved = () =>
    useAppStore.getState().applyState(
      makeState({
        tasks: [
          {
            ...taskOf({
              findings: FINDINGS.map((each) =>
                makeReviewFinding({ ...each, decision: "approved" }),
              ),
            }),
            situations: [makeSituation({ ...DECIDE, form: "apply" })],
          },
        ],
      }),
    );

  it("takes the focus to Apply approved once the rest is approved", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    await user.click(screen.getByRole("button", { name: "Approve the rest" }));
    await waitFor(() => expect(api.approveRestOfPRFindings).toHaveBeenCalled());
    applyApproved();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply approved" })).toHaveFocus(),
    );
  });

  it("takes the focus to Apply approved when the new state arrived before the approval answered", async () => {
    vi.mocked(api.approveRestOfPRFindings).mockImplementationOnce(async () => {
      applyApproved();
    });
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    await user.click(screen.getByRole("button", { name: "Approve the rest" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply approved" })).toHaveFocus(),
    );
  });

  it("leaves the focus alone for good when the bar still offers Approve the rest once approved", async () => {
    // A rewrite brings a new finding to decide as the rest is approved: the bar keeps the button.
    vi.mocked(api.approveRestOfPRFindings).mockImplementationOnce(async () => {
      useAppStore.getState().applyState(
        makeState({
          tasks: [
            taskOf({
              findings: [
                ...FINDINGS.map((each) => makeReviewFinding({ ...each, decision: "approved" })),
                makeReviewFinding({ number: 4, title: "Fourth" }),
              ],
            }),
          ],
        }),
      );
    });
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    await user.click(screen.getByRole("button", { name: "Approve the rest" }));
    await waitFor(() => expect(screen.getByText(/3 of 4 decided/)).toBeInTheDocument());
    await vi.mocked(api.approveRestOfPRFindings).mock.results[0]?.value;
    applyApproved();

    await screen.findByRole("button", { name: "Apply approved" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("button", { name: "Apply approved" })).not.toHaveFocus();
  });

  it("leaves the focus alone when approving the rest failed", async () => {
    vi.mocked(api.approveRestOfPRFindings).mockRejectedValueOnce(new Error("no"));
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    await user.click(screen.getByRole("button", { name: "Approve the rest" }));
    await waitFor(() => expect(useAppStore.getState().error).not.toBeNull());
    applyApproved();

    await screen.findByRole("button", { name: "Apply approved" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("button", { name: "Apply approved" })).not.toHaveFocus();
  });

  it("applies the approved findings with the button", async () => {
    const { user } = screenOf(
      taskOf({
        findings: FINDINGS.map((each) => makeReviewFinding({ ...each, decision: "approved" })),
      }),
    );
    await screen.findByRole("group", { name: "Findings of pass 1" });
    useAppStore.getState().applyState(
      makeState({
        tasks: [
          {
            ...taskOf({
              findings: FINDINGS.map((each) =>
                makeReviewFinding({ ...each, decision: "approved" }),
              ),
            }),
            situations: [makeSituation({ ...DECIDE, form: "apply" })],
          },
        ],
      }),
    );

    await user.click(await screen.findByRole("button", { name: "Apply approved" }));

    expect(api.applyPRFindings).toHaveBeenCalledWith("task-1");
  });

  it.each([
    [
      "the findings to decide, with Approve the rest",
      { ...taskOf(), situations: [DECIDE] },
      "Approve the rest",
    ],
    [
      "the findings ready to apply, with Apply approved",
      {
        ...taskOf({
          findings: FINDINGS.map((each) => makeReviewFinding({ ...each, decision: "approved" })),
        }),
        situations: [makeSituation({ ...DECIDE, form: "apply" })],
      },
      "Apply approved",
    ],
  ])("does not act on Ctrl+Enter on %s: the composer has its own", async (_, task, button) => {
    const { user } = screenOf(task);
    await screen.findByRole("group", { name: "Findings of pass 1" });
    expect(await screen.findByRole("button", { name: button })).toBeEnabled();

    finding(1).focus();
    await user.keyboard("{Control>}{Enter}{/Control}");
    screen.getByRole("region", { name: "Request" }).focus();
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.applyPRFindings).not.toHaveBeenCalled();
    expect(api.approveRestOfPRFindings).not.toHaveBeenCalled();
  });
});
