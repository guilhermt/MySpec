import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PullRequestPanel } from "@/features/reviews/PullRequestPanel";
import { api, type PullRequestRow, type Repository, type State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeBoardCard,
  makePRCheck,
  makePullRequestRow,
  makePullReview,
  makePullsFailure,
  makeRepository,
  makeReviewCenter,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const NOW = Date.parse("2026-09-27T15:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MINUTE = 60_000;

interface Setup {
  row?: Partial<PullRequestRow>;
  repository?: Partial<Repository>;
  app?: Partial<State>;
  panelFocus?: "clone" | null;
}

function panel({ row = {}, repository = {}, app = {}, panelFocus = null }: Setup = {}) {
  const pull = makePullRequestRow({ repository: "acme/api", number: 1302, ...row });
  const state = makeState({
    repositories: [makeRepository({ fullName: "acme/api", ...repository })],
    reviewCenter: makeReviewCenter({ readAt: ago(2 * MINUTE), pullRequests: [pull] }),
    ...app,
  });
  const onClose = vi.fn();
  const onPanelFocused = vi.fn();
  const ui = (
    <PullRequestPanel
      row={pull}
      now={NOW}
      panelFocus={panelFocus}
      onPanelFocused={onPanelFocused}
      onClose={onClose}
    />
  );
  const result = renderWithStore(ui, { state });
  return { ...result, onClose, onPanelFocused, pull };
}

describe("PullRequestPanel", () => {
  it("is the aside of the pull request, with its reference, Open on GitHub and Close", async () => {
    const { user, onClose } = panel();

    const aside = screen.getByRole("complementary", { name: "Pull request api#1302" });
    expect(within(aside).getByText("api#1302")).toBeInTheDocument();
    expect(within(aside).getByText(/acme\/api/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open api#1302 on GitHub" }));
    expect(api.openExternal).toHaveBeenCalledExactlyOnceWith("https://github.com/dev/web/pull/31");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("tells the title, the author, the state, the draft and the age of the update", () => {
    panel({
      row: {
        title: "Idempotency keys",
        author: "lnakamura",
        draft: true,
        updatedAt: ago(120 * MINUTE),
      },
    });

    expect(screen.getByRole("heading", { name: "Idempotency keys" })).toBeInTheDocument();
    expect(screen.getByText("lnakamura").closest("p")).toHaveTextContent(
      "lnakamura · Never reviewed · Draft · updated 2 hours ago",
    );
  });

  it("leaves the state to the block of an active review", () => {
    panel({
      row: { reviewId: "review-1", action: "open_review" },
      app: { reviews: [makeReviewSummary({ id: "review-1" })] },
    });

    expect(screen.getByText("alice").closest("p")).not.toHaveTextContent("Never reviewed");
  });

  describe("the action", () => {
    it("is Start review, the one primary, with R written on it, which opens the dialog", async () => {
      const { user } = panel();

      const start = screen.getByRole("button", { name: "Start review" });
      expect(start).toHaveAttribute("data-variant", "primary");
      expect(start).toHaveTextContent(/^Start reviewR$/);
      await user.click(start);

      expect(useAppStore.getState().startReview).toEqual({ repositoryId: "repo-1", number: 1302 });
    });

    it("says the first pass waits for the checks not finished", () => {
      panel({
        row: { checks: [makePRCheck({ state: "running" }), makePRCheck({ state: "queued" })] },
      });

      expect(screen.getByRole("button", { name: /^Start review/ })).toHaveAccessibleDescription(
        "The first pass waits for the checks: 2 not finished.",
      );
    });

    it("says what a review of your own pull request can do", () => {
      panel({ row: { own: true } });

      expect(screen.getByRole("button", { name: /^Start review/ })).toHaveAccessibleDescription(
        "Your own pull request: the review can publish a comment, or apply its findings.",
      );
    });

    it("dashes Start review on a pull request from a fork, with the reason", async () => {
      const { user } = panel({ row: { action: "fork" } });

      const start = screen.getByRole("button", { name: /^Start review/ });
      expect(start).toHaveAttribute("aria-disabled", "true");
      expect(start).toHaveAccessibleDescription("Pull requests from forks can't be reviewed yet.");
      await user.click(start);
      expect(useAppStore.getState().startReview).toBeNull();
    });

    describe("with an active review", () => {
      const waiting = makeReviewSummary({
        id: "review-1",
        status: "awaiting_decision",
        sessionStatus: "waiting",
        passes: [makeReviewPass({ pass: 1 })],
        situations: [
          makeSituation({
            taskId: "review-1",
            kind: "review_report",
            form: "decide",
            place: { kind: "review", stage: "", step: 0 },
          }),
        ],
      });

      it("shows the block of the review with Open review, primary when it waits for you", async () => {
        const { user } = panel({
          row: { reviewId: "review-1", action: "open_review" },
          app: { reviews: [waiting] },
        });

        expect(screen.getByText("Review of api#1302")).toBeInTheDocument();
        const open = screen.getByRole("button", { name: "Open review" });
        expect(open).toHaveAttribute("data-variant", "primary");
        expect(screen.queryByRole("button", { name: /^Start review/ })).not.toBeInTheDocument();
        await user.click(open);

        expect(useAppStore.getState().location).toEqual({ kind: "review", id: "review-1" });
      });

      it("makes Open review secondary when nothing waits for you", () => {
        panel({
          row: { reviewId: "review-1", action: "open_review" },
          app: { reviews: [makeReviewSummary({ id: "review-1" })] },
        });

        expect(screen.getByRole("button", { name: "Open review" })).toHaveAttribute(
          "data-variant",
          "secondary",
        );
      });
    });

    it("shows the block of the task with Open task, and says the review happens there", async () => {
      const { user } = panel({
        row: { taskId: "task-1", action: "open_task" },
        app: { tasks: [makeTask({ id: "task-1", name: "rate-limit" })] },
      });

      expect(screen.getByText("rate-limit")).toBeInTheDocument();
      expect(
        screen.getByText("The review of this pull request happens in its task."),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Open task" }));

      expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-1" });
    });

    describe("with the clone missing", () => {
      it("dashes Start review, says where the clone should be and offers Change path…", () => {
        panel({ row: { action: "clone_missing" }, repository: { path: "/home/dev/code/api" } });

        const start = screen.getByRole("button", { name: /^Start review/ });
        expect(start).toHaveAttribute("aria-disabled", "true");
        expect(start).toHaveAccessibleDescription("The clone at /home/dev/code/api is missing.");
        expect(screen.getByRole("button", { name: "Change path…" })).toBeInTheDocument();
      });

      it("moves the focus to Start review once the path changes and the pull request can be reviewed", async () => {
        vi.mocked(api.changeRepositoryPath).mockResolvedValue(true);
        const { user, rerender, pull } = panel({ row: { action: "clone_missing" } });

        await user.click(screen.getByRole("button", { name: "Change path…" }));
        expect(api.changeRepositoryPath).toHaveBeenCalledExactlyOnceWith("repo-1");
        rerender(
          <PullRequestPanel
            row={{ ...pull, action: "review" }}
            now={NOW}
            panelFocus={null}
            onPanelFocused={() => {}}
            onClose={() => {}}
          />,
        );

        await waitFor(() =>
          expect(screen.getByRole("button", { name: /^Start review/ })).toHaveFocus(),
        );
      });

      it("moves the focus to Start review of your own pull request once the path changes", async () => {
        vi.mocked(api.changeRepositoryPath).mockResolvedValue(true);
        const { user, rerender, pull } = panel({ row: { action: "clone_missing", own: true } });

        await user.click(screen.getByRole("button", { name: "Change path…" }));
        rerender(
          <PullRequestPanel
            row={{ ...pull, action: "review" }}
            now={NOW}
            panelFocus={null}
            onPanelFocused={() => {}}
            onClose={() => {}}
          />,
        );

        const start = await screen.findByRole("button", { name: /^Start review/ });
        expect(start).toHaveAccessibleDescription(
          "Your own pull request: the review can publish a comment, or apply its findings.",
        );
        await waitFor(() => expect(start).toHaveFocus());
      });

      it("leaves the focus alone when the user cancels the chooser", async () => {
        vi.mocked(api.changeRepositoryPath).mockResolvedValue(false);
        const { user, rerender, pull } = panel({ row: { action: "clone_missing" } });

        await user.click(screen.getByRole("button", { name: "Change path…" }));
        rerender(
          <PullRequestPanel
            row={{ ...pull, action: "review" }}
            now={NOW}
            panelFocus={null}
            onPanelFocused={() => {}}
            onClose={() => {}}
          />,
        );

        expect(screen.getByRole("button", { name: /^Start review/ })).not.toHaveFocus();
      });

      it("says what the chooser refused, under the action", async () => {
        vi.mocked(api.changeRepositoryPath).mockRejectedValue(
          new Error("That folder isn't a clone of acme/api."),
        );
        const { user } = panel({ row: { action: "clone_missing" } });

        await user.click(screen.getByRole("button", { name: "Change path…" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
          "That folder isn't a clone of acme/api.",
        );
      });
    });

    describe("without a clone", () => {
      it("offers Clone and continue, and waits for the clone to open the dialog", async () => {
        vi.mocked(api.cloneRepository).mockResolvedValue(true);
        const { user } = panel({
          row: { action: "clone" },
          repository: { cloned: false, path: "" },
        });

        const clone = screen.getByRole("button", { name: "Clone and continue" });
        expect(clone).toHaveAccessibleDescription(
          "acme/api isn't cloned yet. A review needs a clone.",
        );
        // The key is written on the button, and the tooltip says what it does with the key.
        expect(clone).toHaveTextContent(/^Clone and continueR$/);
        await user.hover(clone);
        expect(await screen.findByRole("tooltip")).toHaveTextContent(
          /^Clone, then open the start dialogR$/,
        );
        await user.click(clone);

        expect(api.cloneRepository).toHaveBeenCalledExactlyOnceWith("repo-1");
        await waitFor(() =>
          expect(useAppStore.getState().pendingReview).toEqual({
            repositoryId: "repo-1",
            number: 1302,
          }),
        );
        expect(useAppStore.getState().startReview).toBeNull();
      });

      it("does not wait for a clone the user cancelled", async () => {
        vi.mocked(api.cloneRepository).mockResolvedValue(false);
        const { user } = panel({
          row: { action: "clone" },
          repository: { cloned: false, path: "" },
        });

        await user.click(screen.getByRole("button", { name: /^Clone and continue/ }));

        expect(useAppStore.getState().pendingReview).toBeNull();
      });

      it("shows the clone running, and says the dialog opens when it ends", () => {
        panel({ row: { action: "clone" }, repository: { cloned: false, cloning: true, path: "" } });

        const busy = screen.getByRole("button", { name: "Cloning acme/api…" });
        expect(busy).toHaveAttribute("aria-busy", "true");
        expect(busy).toHaveAccessibleDescription("The dialog opens when the clone ends.");
      });

      it("offers the clone again with the message of gh when it failed", () => {
        panel({
          row: { action: "clone" },
          repository: { cloned: false, path: "", cloneError: "gh: repository not found" },
        });

        expect(screen.getByRole("button", { name: "Try the clone again" })).toHaveTextContent(
          /^Try the clone againR$/,
        );
        expect(screen.getByRole("alert")).toHaveTextContent("gh: repository not found");
      });

      it("says what stopped the clone from starting", async () => {
        vi.mocked(api.cloneRepository).mockRejectedValue(new Error("No folder for the clones."));
        const { user } = panel({
          row: { action: "clone" },
          repository: { cloned: false, path: "" },
        });

        await user.click(screen.getByRole("button", { name: /^Clone and continue/ }));

        expect(await screen.findByRole("alert")).toHaveTextContent("No folder for the clones.");
      });
    });
  });

  describe("the focus asked by R", () => {
    it("goes to the button of the clone, and the panel says it took the request", async () => {
      const { onPanelFocused } = panel({
        row: { action: "clone" },
        repository: { cloned: false, path: "" },
        panelFocus: "clone",
      });

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /^Clone and continue/ })).toHaveFocus(),
      );
      expect(onPanelFocused).toHaveBeenCalledOnce();
    });

    it("goes to the button that is running the clone too", async () => {
      panel({
        row: { action: "clone" },
        repository: { cloned: false, cloning: true, path: "" },
        panelFocus: "clone",
      });

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Cloning acme/api…" })).toHaveFocus(),
      );
    });

    it("does nothing without the request", () => {
      const { onPanelFocused } = panel({
        row: { action: "clone" },
        repository: { cloned: false, path: "" },
      });

      expect(onPanelFocused).not.toHaveBeenCalled();
    });
  });

  describe("the checks", () => {
    it("lists them by name, with the summary, the duration and the age of the reading", () => {
      panel({
        row: {
          mergeable: "mergeable",
          baseBranch: "dev",
          checks: [
            makePRCheck({
              name: "build",
              state: "passed",
              startedAt: ago(10 * MINUTE),
              completedAt: ago(8 * MINUTE),
            }),
            makePRCheck({
              name: "e2e",
              state: "failed",
              conclusion: "failure",
              url: "https://github.com/acme/web/actions/runs/2",
            }),
          ],
        },
      });

      expect(
        screen.getByText("1 failed · 1 of 2 passed · merges clean into dev"),
      ).toBeInTheDocument();
      const rows = within(screen.getByRole("list", { name: "Checks" })).getAllByRole("listitem");
      expect(rows).toHaveLength(2);
      expect(within(rows[0] as HTMLElement).getByText("2m 0s")).toBeInTheDocument();
      expect(screen.getByText("read 2m ago")).toBeInTheDocument();
    });

    it("says there are no checks", () => {
      panel({ row: { checks: [] } });

      expect(screen.getByText("No checks")).toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Checks" })).not.toBeInTheDocument();
    });

    it("puts the failure of the repository where the age would be", () => {
      panel({
        app: {
          reviewCenter: makeReviewCenter({
            readAt: ago(2 * MINUTE),
            pullRequests: [makePullRequestRow({ repositoryId: "repo-1" })],
            failures: [
              makePullsFailure({
                repositoryId: "repo-1",
                repository: "acme/api",
                failedAt: ago(4 * MINUTE),
              }),
            ],
          }),
        },
      });

      expect(screen.getByText("acme/api couldn't be read · 4m ago")).toBeInTheDocument();
      expect(screen.queryByText("read 2m ago")).not.toBeInTheDocument();
    });
  });

  describe("the facts", () => {
    it("tells the branch, and leaves out what has no value", () => {
      panel({ row: { headBranch: "idempotency-keys", baseBranch: "dev" } });

      const facts = screen.getByText("Branch").closest("dl") as HTMLElement;
      expect(within(facts).getByText("idempotency-keys → dev")).toBeInTheDocument();
      expect(within(facts).queryByText("Card")).not.toBeInTheDocument();
      expect(within(facts).queryByText("Labels")).not.toBeInTheDocument();
      expect(within(facts).queryByText("Your review")).not.toBeInTheDocument();
    });

    it("tells the labels by commas", () => {
      panel({
        row: {
          labels: [
            { name: "payments", color: "fff" },
            { name: "backend", color: "000" },
          ],
        },
      });

      expect(screen.getByText("payments, backend")).toBeInTheDocument();
    });

    it("tells your review on a pull request reviewed", () => {
      panel({
        row: {
          pending: false,
          reviewed: true,
          yourReview: makePullReview({
            state: "approved",
            at: new Date(2026, 8, 27, 10, 2).toISOString(),
          }),
        },
      });

      expect(screen.getByText(/^You approved it/)).toBeInTheDocument();
    });

    it("opens the card in the board when the reading of the board has it", async () => {
      const card = {
        boardId: "board-1",
        number: 452,
        title: "Idempotency keys",
        url: "https://github.com/acme/api/issues/452",
        status: "In progress",
      };
      const { user } = panel({
        row: { card },
        app: {
          boards: [
            makeBoard({
              id: "board-1",
              cards: [makeBoardCard({ key: "acme/api#452", number: 452, url: card.url })],
            }),
          ],
        },
      });

      expect(screen.getByText(/Idempotency keys · In progress/)).toBeInTheDocument();
      await user.click(screen.getByRole("link", { name: "#452" }));

      expect(useAppStore.getState().location).toEqual({ kind: "board", id: "board-1" });
      expect(useAppStore.getState().boardCardRequest).toEqual({
        boardId: "board-1",
        key: "acme/api#452",
      });
      expect(api.openExternal).not.toHaveBeenCalled();
    });

    it("opens the card on GitHub when the board does not have it", async () => {
      const card = {
        boardId: "board-1",
        number: 452,
        title: "Idempotency keys",
        url: "https://github.com/acme/api/issues/452",
        status: "",
      };
      const { user } = panel({ row: { card } });

      await user.click(screen.getByRole("link", { name: "#452" }));

      expect(api.openExternal).toHaveBeenCalledExactlyOnceWith(
        "https://github.com/acme/api/issues/452",
      );
    });
  });

  describe("the description", () => {
    it("gives the description to the Markdown, in the class of the body of a card", () => {
      panel({ row: { body: "Adds a key per charge.\n\n## Testing" } });

      const description = screen.getByTestId("markdown");
      expect(description).toHaveTextContent("Adds a key per charge.");
      expect(description).toHaveClass("card-body");
      expect(screen.queryByText("No description.")).not.toBeInTheDocument();
    });

    it("says there is none when it is empty or blank", () => {
      panel({ row: { body: "  \n" } });

      expect(screen.getByText("No description.")).toBeInTheDocument();
    });
  });

  it("follows a reading that brings new data for the same pull request", () => {
    const { rerender, pull } = panel({ row: { title: "Before" } });

    act(() => {});
    rerender(
      <PullRequestPanel
        row={{ ...pull, title: "After" }}
        now={NOW}
        panelFocus={null}
        onPanelFocused={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "After" })).toBeInTheDocument();
  });
});
