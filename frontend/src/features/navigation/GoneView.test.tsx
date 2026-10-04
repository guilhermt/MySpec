import { act, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoneView } from "@/features/navigation/GoneView";
import type { GoneLocation, Location } from "@/lib/locations";
import type { State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeBoard,
  makeCloseResult,
  makeDraft,
  makeLeftover,
  makeRepository,
  makeReviewFinding,
  makeReviewPass,
  makeSituation,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const WAITING = makeTask({
  id: "task-2",
  name: "fix-header",
  situations: [makeSituation({ taskId: "task-2" })],
});

function stateWith(overrides: Partial<State> = {}): State {
  return makeState({
    boards: [makeBoard({ title: "Platform Roadmap" })],
    repositories: [makeRepository({ boardId: "board-1" })],
    tasks: [WAITING],
    ...overrides,
  });
}

// today is a moment of today, as the page tells it: by the time alone.
function today(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function gone(item: GoneLocation["item"], id: string, name: string, boardId = ""): GoneLocation {
  return { kind: "gone", item, id, name, boardId };
}

function page(location: GoneLocation, state: State, back: Location[] = []) {
  return renderWithStore(<GoneView location={location} />, {
    state,
    ui: { location, back },
  });
}

function buttons(): string[] {
  return screen.getAllByRole("button").map((button) => button.textContent ?? "");
}

function actions(): string[] {
  return buttons().filter((label) => label !== "");
}

describe("GoneView", () => {
  it("shows a task that was closed and archived", () => {
    page(
      gone("task", "task-1", "add-login", "board-1"),
      stateWith({ history: [makeArchivedTask({ id: "task-1" })] }),
    );

    expect(screen.getByText("add-login was closed and archived")).toBeInTheDocument();
    expect(actions()).toEqual([
      "Next that needs you",
      "Open in History",
      "Back to Platform Roadmap",
    ]);
    expect(screen.getByRole("button", { name: /Next that needs you/ })).toHaveFocus();
  });

  it("tells what became of the pull request and the closing of the task, with its result", () => {
    const closedAt = today(15, 2);
    page(
      gone("task", "task-1", "add-login", "board-1"),
      stateWith({
        history: [
          makeArchivedTask({
            id: "task-1",
            pr: {
              number: 12,
              url: "",
              state: "merged",
              base: "dev",
              mergedBy: "",
              mergedAt: today(14, 51),
            },
            close: makeCloseResult({ closedAt }),
          }),
        ],
      }),
    );

    expect(
      screen.getByText(
        "PR #12 was merged into dev at 14:51. MySpec closed the task at 15:02; its documents, steps and reports are in History.",
      ),
    ).toBeInTheDocument();
    const closing = screen.getByRole("group", { name: "What the closing did" });
    expect(closing).toHaveTextContent("Closing");
    expect(closing).toHaveTextContent("15:02");
    expect(within(closing).getByText("Worktree removed")).toBeInTheDocument();
  });

  it("leaves out the closing of a task archived without its result", () => {
    page(
      gone("task", "task-1", "add-login", "board-1"),
      stateWith({ history: [makeArchivedTask({ id: "task-1", close: null })] }),
    );

    expect(screen.queryByRole("group", { name: "What the closing did" })).not.toBeInTheDocument();
  });

  it("shows a task that was deleted, going back Home without a board", () => {
    page(gone("task", "task-1", "add-login"), stateWith());

    expect(screen.getByText("add-login was deleted")).toBeInTheDocument();
    expect(actions()).toEqual(["Next that needs you", "Back to Home"]);
  });

  it.each([
    [{ number: 1284, state: "open" as const }, " PR #1284 stays open on GitHub."],
    [{ number: 1284, state: "merged" as const }, " PR #1284 stays on GitHub, merged."],
    [{ number: 1284, state: "closed" as const }, " PR #1284 stays on GitHub, closed."],
    [null, ""],
  ])("tells what stays of the pull request of a task that was deleted: %j", (pr, tail) => {
    page({ ...gone("task", "task-1", "add-login"), pr }, stateWith());

    expect(
      screen.getByText(`The documents, the steps and every record of the task are gone.${tail}`),
    ).toBeInTheDocument();
  });

  it("shows a review that was merged", () => {
    page(
      gone("review", "review-1", "web#12"),
      stateWith({ reviewHistory: [makeArchivedReview({ id: "review-1", outcome: "merged" })] }),
    );

    expect(screen.getByText("web#12 was merged, and its review ended")).toBeInTheDocument();
    expect(actions()).toEqual(["Next that needs you", "Open in History", "Back to Reviews"]);
  });

  it("tells who merged the pull request and when, then the result of each pass", () => {
    const at = today;
    page(
      gone("review", "review-1", "web#12"),
      stateWith({
        reviewHistory: [
          makeArchivedReview({
            id: "review-1",
            outcome: "merged",
            mergedBy: "rsouza",
            mergedAt: at(16, 20),
            baseBranch: "dev",
            passes: [
              makeReviewPass({
                pass: 1,
                published: true,
                publishedAt: at(13, 41),
                verdict: "request_changes",
                findings: [
                  makeReviewFinding({ number: 1, placement: "inline" }),
                  makeReviewFinding({ number: 2, placement: "inline" }),
                ],
              }),
              makeReviewPass({ pass: 2, file: "review-2.md", findings: [] }),
            ],
          }),
        ],
      }),
    );

    expect(
      screen.getByText(
        "rsouza merged it into dev at 16:20. MySpec stopped the session and removed the worktree. The reports and the verdicts are in History; the conversation isn't kept.",
      ),
    ).toBeInTheDocument();
    const passes = screen.getByRole("list", { name: "Passes" });
    expect(
      within(passes)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Pass 1 · Request changes · 2 inline comments13:41", "Pass 2 · not published"]);
  });

  it("tells when a pull request was closed without a merge", () => {
    const closedAt = today(16, 20);
    page(
      gone("review", "review-1", "web#12"),
      stateWith({
        reviewHistory: [makeArchivedReview({ id: "review-1", outcome: "closed", closedAt })],
      }),
    );

    expect(
      screen.getByText(/^It was closed at 16:20\. MySpec stopped the session/),
    ).toBeInTheDocument();
  });

  it("leaves out a time the archive didn't keep, and the passes of a review without any report", () => {
    page(
      gone("review", "review-1", "web#12"),
      stateWith({
        reviewHistory: [
          makeArchivedReview({ id: "review-1", outcome: "merged", passes: [], mergedBy: "" }),
        ],
      }),
    );

    expect(
      screen.getByText(/^It was merged into dev\. MySpec stopped the session/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Passes" })).not.toBeInTheDocument();
  });

  it("says nothing more of a review that was deleted", () => {
    page(gone("review", "review-1", "web#12"), stateWith());

    expect(screen.queryByText(/MySpec stopped the session/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Passes" })).not.toBeInTheDocument();
  });

  it("shows a review that was closed without a merge", () => {
    page(
      gone("review", "review-1", "web#12"),
      stateWith({ reviewHistory: [makeArchivedReview({ id: "review-1", outcome: "closed" })] }),
    );

    expect(screen.getByText("web#12 was closed without a merge")).toBeInTheDocument();
    expect(actions()).toEqual(["Next that needs you", "Open in History", "Back to Reviews"]);
  });

  it("shows a review that was deleted, going back to Reviews", async () => {
    const { user } = page(gone("review", "review-1", "web#12"), stateWith());

    expect(screen.getByText("web#12 was deleted")).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-trash-2")).not.toBeNull();
    expect(actions()).toEqual(["Next that needs you", "Back to Reviews"]);

    await user.click(screen.getByRole("button", { name: "Back to Reviews" }));

    expect(useAppStore.getState().location).toEqual({ kind: "reviews" });
  });

  it("shows a discussion that was archived, opening its board", () => {
    page(
      gone("discussion", "discussion-1", "Invoices", "board-1"),
      stateWith({ discussionHistory: [makeArchivedDiscussion({ id: "discussion-1" })] }),
    );

    expect(screen.getByText("Invoices was archived")).toBeInTheDocument();
    expect(actions()).toEqual(["Next that needs you", "Open in History", "Open Platform Roadmap"]);
  });

  it("tells the rounds of an archived discussion", () => {
    page(
      gone("discussion", "discussion-1", "Invoices", "board-1"),
      stateWith({
        discussionHistory: [
          makeArchivedDiscussion({
            id: "discussion-1",
            drafts: [
              makeDraft({ id: "a", round: 1, published: true, outcome: "created" }),
              makeDraft({ id: "b", round: 2 }),
            ],
          }),
        ],
      }),
    );

    expect(screen.getByText(/^The conversation ended/)).toBeInTheDocument();
    const rounds = within(screen.getByRole("list", { name: "Rounds" })).getAllByRole("listitem");
    expect(rounds.map((round) => round.textContent)).toEqual([
      expect.stringMatching(/^Round 1 · 1 created/),
      "Round 2 · nothing published",
    ]);
  });

  it("shows a discussion that was deleted, going back Home once its board is gone", () => {
    page(gone("discussion", "discussion-1", "Invoices", "board-9"), stateWith());

    expect(screen.getByText("Invoices was deleted")).toBeInTheDocument();
    expect(
      screen.getByText(/^The conversation, the document and the drafts are gone/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Rounds" })).not.toBeInTheDocument();
    expect(actions()).toEqual(["Next that needs you", "Back to Home"]);
  });

  it("shows a board that was removed, going back to the place before it", async () => {
    const { user } = page(gone("board", "board-2", "Ops"), stateWith(), [{ kind: "reviews" }]);

    expect(screen.getByText("This board was removed.")).toBeInTheDocument();
    // The header has its own Back to Reviews, named without a text of its own.
    const back = screen.getByText("Back to Reviews", { selector: "button" });
    expect(back).toHaveFocus();

    await user.click(back);

    expect(useAppStore.getState().location).toEqual({ kind: "reviews" });
  });

  it("makes Open in History the primary when nothing else needs the user", () => {
    page(
      gone("task", "task-1", "add-login"),
      stateWith({ tasks: [], history: [makeArchivedTask({ id: "task-1" })] }),
    );

    expect(screen.getByRole("button", { name: /Next that needs you/ })).toHaveAccessibleDescription(
      "Nothing else needs you now.",
    );
    expect(screen.getByRole("button", { name: "Open in History" })).toHaveFocus();
  });

  it("opens the next item that needs the user", async () => {
    const { user } = page(gone("task", "task-1", "add-login"), stateWith());

    await user.click(screen.getByRole("button", { name: /Next that needs you/ }));

    expect(useAppStore.getState().location).toEqual({ kind: "task", id: WAITING.id });
  });

  it("opens the History on the row of the archived item", async () => {
    const { user } = page(
      gone("task", "task-1", "add-login"),
      stateWith({ history: [makeArchivedTask({ id: "task-1" })] }),
    );

    await user.click(screen.getByRole("button", { name: "Open in History" }));

    expect(useAppStore.getState().location).toEqual({
      kind: "history",
      fresh: { kind: "task", id: "task-1" },
    });
  });

  it.each<["review" | "discussion", Partial<State>]>([
    ["review", { reviewHistory: [makeArchivedReview({ id: "item-1" })] }],
    ["discussion", { discussionHistory: [makeArchivedDiscussion({ id: "item-1" })] }],
  ])("opens the History on the row of the %s that ended", async (item, archive) => {
    const { user } = page(gone(item, "item-1", "x"), stateWith(archive));

    await user.click(screen.getByRole("button", { name: "Open in History" }));

    expect(useAppStore.getState().location).toEqual({
      kind: "history",
      fresh: { kind: item, id: "item-1" },
    });
  });

  describe("what stayed on disk", () => {
    const worktree = {
      path: "/home/dev/.local/share/myspec/worktrees/acme/api/add-login",
      kept: true,
      error: "contains modified files",
    };
    const branch = { name: "add-login", kept: true, error: "checked out" };
    const WORKTREE_COMMAND =
      "git worktree remove --force ~/.local/share/myspec/worktrees/acme/api/add-login";

    function stayed(): HTMLElement {
      return screen.getByRole("group", { name: "What stayed on disk" });
    }

    it("shows nothing when git removed everything", () => {
      page(gone("task", "task-1", "add-login"), stateWith());

      expect(screen.queryByRole("group", { name: "What stayed on disk" })).not.toBeInTheDocument();
    });

    it.each([
      ["only the worktree", { worktree, branch: null }, [WORKTREE_COMMAND], true],
      ["only the branch", { worktree: null, branch }, ["git branch -D add-login"], false],
      ["both", { worktree, branch }, [WORKTREE_COMMAND, "git branch -D add-login"], true],
    ])("shows %s", (_name, parts, commands, warned) => {
      const leftover = makeLeftover({ repoPath: "/home/dev/code/api", ...parts });
      renderWithStore(<GoneView location={gone("task", "task-1", "add-login")} />, {
        state: stateWith(),
        ui: { location: gone("task", "task-1", "add-login"), leftovers: { "task-1": leftover } },
      });

      expect(stayed()).toHaveTextContent("Git couldn't remove everything");
      expect(screen.getByText("To remove it yourself, in ~/code/api")).toBeInTheDocument();
      expect(document.querySelector("pre")?.textContent).toBe(commands.join("\n"));
      const warning = screen.queryByText(/--force deletes the modified and untracked files/);
      expect(warning !== null).toBe(warned);
    });

    it("comes in when the answer of the deletion arrives, without taking the focus", () => {
      const location = gone("task", "task-1", "add-login");
      renderWithStore(<GoneView location={location} />, { state: stateWith(), ui: { location } });
      const primary = screen.getByRole("button", { name: /Next that needs you/ });
      expect(primary).toHaveFocus();

      act(() =>
        useAppStore.setState({
          leftovers: { "task-1": makeLeftover({ worktree, branch: null }) },
        }),
      );

      expect(stayed()).toBeInTheDocument();
      expect(primary).toHaveFocus();
    });

    it("shows what a review that was deleted left, in its clone", () => {
      const location = gone("review", "review-1", "web#12");
      renderWithStore(<GoneView location={location} />, {
        state: stateWith(),
        ui: {
          location,
          leftovers: { "review-1": makeLeftover({ repoPath: "/home/dev/code/web", worktree }) },
        },
      });

      expect(screen.getByText("To remove it yourself, in ~/code/web")).toBeInTheDocument();
      expect(screen.getByText(WORKTREE_COMMAND, { selector: "pre" })).toBeInTheDocument();
    });

    it("copies the command", async () => {
      const location = gone("task", "task-1", "add-login");
      const { user } = renderWithStore(<GoneView location={location} />, {
        state: stateWith(),
        ui: { location, leftovers: { "task-1": makeLeftover({ worktree, branch }) } },
      });
      const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

      await user.click(screen.getByRole("button", { name: "Copy the command" }));

      expect(writeText).toHaveBeenCalledWith(`${WORKTREE_COMMAND}\ngit branch -D add-login`);
    });
  });
});
