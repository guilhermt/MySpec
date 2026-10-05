import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StartReviewDialog } from "@/features/reviews/StartReviewDialog";
import { api, type PullRequestRow, type Repository } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makePRCheck,
  makePullRequestRow,
  makeRepository,
  makeReviewCenter,
  makeState,
} from "@/test/wails-mock";

const PULL = { repositoryId: "repo-1", number: 31 };

function dialog(row: Partial<PullRequestRow> = {}, repository: Partial<Repository> = {}) {
  const state = makeState({
    repositories: [makeRepository(repository)],
    reviewCenter: makeReviewCenter({
      readAt: "2026-09-16T12:00:00Z",
      pullRequests: [makePullRequestRow({ mergeable: "mergeable", ...row })],
    }),
  });
  return renderWithStore(<StartReviewDialog />, { state, ui: { startReview: PULL } });
}

describe("StartReviewDialog", () => {
  it("shows nothing until a pull request is chosen", () => {
    renderWithStore(<StartReviewDialog />, { state: makeState() });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("names the dialog for the pull request and sums it up in a sunken line", () => {
    dialog({
      card: { boardId: "board-1", number: 452, title: "Idempotency", url: "", status: "" },
    });

    const dialogElement = screen.getByRole("dialog", { name: "Review web#31" });
    expect(within(dialogElement).getByText("Add the login screen")).toBeInTheDocument();
    expect(
      within(dialogElement).getByText("alice · login-screen → dev · card #452"),
    ).toBeInTheDocument();
  });

  it("leaves the card out of the summary of a pull request without one, and says you for the user's own", () => {
    dialog({ own: true });

    expect(screen.getByText("you · login-screen → dev")).toBeInTheDocument();
  });

  it("starts with the focus on Start review, the one primary", async () => {
    dialog();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Start review/ })).toHaveFocus(),
    );
    expect(screen.getByRole("button", { name: /^Start review/ })).toHaveAttribute(
      "data-variant",
      "primary",
    );
  });

  it("starts the review with the defaults, the instructions behind a click", async () => {
    vi.mocked(api.startReview).mockResolvedValue("review-1");
    const { user } = dialog();

    expect(screen.queryByLabelText(/^Instructions/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Start review/ }));

    expect(api.startReview).toHaveBeenCalledExactlyOnceWith({
      repositoryId: "repo-1",
      number: 31,
      instructions: "",
      model: "claude-opus-5-5[1m]",
      effort: "high",
      mode: "publish",
    });
    await waitFor(() =>
      expect(useAppStore.getState().location).toEqual({ kind: "review", id: "review-1" }),
    );
    expect(useAppStore.getState().startReview).toBeNull();
  });

  it("says where the model comes from", () => {
    dialog();

    expect(
      screen.getByText("From Defaults. It can change in the conversation."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Review model:/ })).toBeInTheDocument();
  });

  it("stops saying the model comes from Defaults once it is changed", async () => {
    const { user } = dialog();

    await user.click(screen.getByRole("button", { name: /^Review model:/ }));
    const options = await screen.findAllByRole("menuitemradio");
    const other = options.find((option) => option.getAttribute("aria-checked") !== "true");
    await user.click(other as HTMLElement);

    expect(screen.getByText("It can change in the conversation.")).toBeInTheDocument();
    expect(screen.queryByText(/From Defaults/)).not.toBeInTheDocument();
  });

  it("opens Instructions on Add instructions, with the focus in it, and sends them", async () => {
    vi.mocked(api.startReview).mockResolvedValue("review-1");
    const { user } = dialog();

    await user.click(screen.getByRole("button", { name: "Add instructions" }));

    const field = screen.getByLabelText(/^Instructions/);
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("placeholder", "What to look at in this pass.");
    expect(
      screen.getByText(
        "They go to the agent with the pull request, and show as your first message.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add instructions" })).not.toBeInTheDocument();
    await user.type(field, "Watch the migrations.");
    await user.click(screen.getByRole("button", { name: /^Start review/ }));

    expect(api.startReview).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: "Watch the migrations." }),
    );
  });

  it("starts the review on Ctrl+Enter from the instructions", async () => {
    vi.mocked(api.startReview).mockResolvedValue("review-1");
    const { user } = dialog();

    await user.click(screen.getByRole("button", { name: "Add instructions" }));
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.startReview).toHaveBeenCalledOnce();
  });

  it("closes on Esc, and closes the open listbox of the model first", async () => {
    const { user } = dialog();

    await user.click(screen.getByRole("button", { name: /^Review model:/ }));
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(useAppStore.getState().startReview).toEqual(PULL);
    await user.keyboard("{Escape}");
    expect(useAppStore.getState().startReview).toBeNull();
  });

  describe("the mode", () => {
    it("is offered only for a pull request of the user", () => {
      dialog();

      expect(screen.queryByRole("button", { name: /^Mode/ })).not.toBeInTheDocument();
    });

    it("opens behind Mode · Publish, with the focus on the one chosen and what it does", async () => {
      vi.mocked(api.startReview).mockResolvedValue("review-1");
      const { user } = dialog({ own: true });

      await user.click(screen.getByRole("button", { name: /^Mode · Publish/ }));

      expect(screen.getByRole("radio", { name: "Publish" })).toHaveFocus();
      expect(
        screen.getByText(
          "Publish posts the approved findings as a review on GitHub. Fixed once the review starts.",
        ),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("radio", { name: "Apply" }));
      expect(
        screen.getByText(
          "Apply has the agent fix the approved findings and push them to the pull request. Fixed once the review starts.",
        ),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /^Start review/ }));

      expect(api.startReview).toHaveBeenCalledWith(expect.objectContaining({ mode: "apply" }));
    });
  });

  describe("the wait for the checks", () => {
    it("says the first pass waits for the checks, with how many passed", () => {
      dialog({
        checks: [
          makePRCheck({ name: "build", state: "passed" }),
          makePRCheck({ name: "lint", state: "passed" }),
          makePRCheck({ name: "e2e", state: "running" }),
          makePRCheck({ name: "deploy", state: "queued" }),
          makePRCheck({ name: "unit", state: "passed" }),
        ],
      });

      expect(
        screen.getByText(
          "The first pass starts when the checks finish: 3 of 5 passed. You can leave meanwhile.",
        ),
      ).toBeInTheDocument();
    });

    it("says it waits for GitHub when the merge is not calculated", () => {
      dialog({ mergeable: "unknown", checks: [makePRCheck()] });

      expect(
        screen.getByText(
          "The first pass starts when GitHub says whether it merges clean. You can leave meanwhile.",
        ),
      ).toBeInTheDocument();
    });

    it("says nothing when the checks are done and the merge is known", () => {
      dialog({ checks: [makePRCheck()] });

      expect(screen.queryByText(/The first pass starts when/)).not.toBeInTheDocument();
    });
  });

  describe("while it starts", () => {
    it("shows Starting… and the worktree, with the fields read-only and Cancel dashed", async () => {
      vi.mocked(api.startReview).mockReturnValue(new Promise(() => {}));
      const { user } = dialog();
      await user.click(screen.getByRole("button", { name: "Add instructions" }));
      await user.type(screen.getByLabelText(/^Instructions/), "x");

      await user.click(screen.getByRole("button", { name: /^Start review/ }));

      const starting = screen.getByRole("button", { name: "Starting…" });
      expect(starting).toHaveAttribute("aria-busy", "true");
      expect(screen.getByText("Creating the worktree…")).toBeInTheDocument();
      expect(screen.getByLabelText(/^Instructions/)).toHaveAttribute("readonly");
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await user.keyboard("{Escape}");
      expect(useAppStore.getState().startReview).toEqual(PULL);
    });
  });

  describe("the refusals", () => {
    it("shows what the start failed with in the footer, stays open and lets Start review repeat it", async () => {
      vi.mocked(api.startReview)
        .mockRejectedValueOnce(new Error("git worktree add failed: exit 128. Nothing was created."))
        .mockResolvedValueOnce("review-1");
      const { user } = dialog();

      await user.click(screen.getByRole("button", { name: /^Start review/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "git worktree add failed: exit 128. Nothing was created.",
      );
      expect(useAppStore.getState().startReview).toEqual(PULL);
      await user.click(screen.getByRole("button", { name: /^Start review/ }));
      await waitFor(() => expect(api.startReview).toHaveBeenCalledTimes(2));
    });

    it("explains a repository without a clone and dashes Start review", async () => {
      const { user } = dialog({ action: "clone" }, { cloned: false, path: "" });

      const start = screen.getByRole("button", { name: /^Start review/ });
      expect(start).toHaveAttribute("aria-disabled", "true");
      expect(start).toHaveAccessibleDescription(
        "dev/web isn't cloned yet. A review needs a clone.",
      );
      await user.click(start);
      await user.keyboard("{Control>}{Enter}{/Control}");

      expect(api.startReview).not.toHaveBeenCalled();
    });

    it("says the pull request is not in the last reading when it leaves with the dialog open", async () => {
      const { user } = dialog();
      await user.click(screen.getByRole("button", { name: "Add instructions" }));
      await user.type(screen.getByLabelText(/^Instructions/), "Watch the migrations.");

      act(() => {
        useAppStore.getState().applyState(
          makeState({
            repositories: [makeRepository()],
            reviewCenter: makeReviewCenter({ readAt: "2026-09-16T12:05:00Z", pullRequests: [] }),
          }),
        );
      });

      const start = screen.getByRole("button", { name: /^Start review/ });
      expect(start).toHaveAttribute("aria-disabled", "true");
      expect(start).toHaveAccessibleDescription(
        "web#31 isn't in the last reading. It was merged or closed.",
      );
      expect(screen.getByLabelText(/^Instructions/)).toHaveValue("Watch the migrations.");
      await user.click(start);
      expect(api.startReview).not.toHaveBeenCalled();
    });

    it("says it for a pull request the reading never had", () => {
      renderWithStore(<StartReviewDialog />, {
        state: makeState({
          repositories: [makeRepository()],
          reviewCenter: makeReviewCenter({ pullRequests: [] }),
        }),
        ui: { startReview: PULL },
      });

      expect(screen.getByRole("dialog", { name: "Review web#31" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Start review/ })).toHaveAccessibleDescription(
        "web#31 isn't in the last reading. It was merged or closed.",
      );
    });
  });

  it("starts afresh when it is opened for another pull request", async () => {
    const state = makeState({
      repositories: [makeRepository()],
      reviewCenter: makeReviewCenter({
        pullRequests: [
          makePullRequestRow({ mergeable: "mergeable" }),
          makePullRequestRow({
            key: "dev/web#32",
            number: 32,
            title: "Fix the header",
            mergeable: "mergeable",
          }),
        ],
      }),
    });
    const { user } = renderWithStore(<StartReviewDialog />, {
      state,
      ui: { startReview: { repositoryId: "repo-1", number: 32 } },
    });
    await user.click(screen.getByRole("button", { name: "Add instructions" }));
    await user.type(screen.getByLabelText(/^Instructions/), "Watch the migrations.");

    act(() => {
      useAppStore.getState().openStartReview(PULL);
    });

    expect(await screen.findByText("Add the login screen")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Instructions/)).not.toBeInTheDocument();
  });

  it("closes without starting anything on Cancel", async () => {
    const { user } = dialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.startReview).not.toHaveBeenCalled();
    expect(useAppStore.getState().startReview).toBeNull();
  });
});
