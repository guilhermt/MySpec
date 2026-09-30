import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewMenu } from "@/features/reviews/ReviewMenu";
import { api, type ReviewSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewSummary, makeState } from "@/test/wails-mock";

function menu(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary({ worktreePath: "/w/web/review-31", ...overrides });
  return renderWithStore(<ReviewMenu review={review} />, {
    state: makeState({ reviews: [review] }),
  });
}

async function openMenu(user: ReturnType<typeof menu>["user"]) {
  await user.click(screen.getByRole("button", { name: "More actions" }));
  return screen.findByRole("menu");
}

describe("ReviewMenu", () => {
  it("groups the pull request and the review, the deletion last after a separator", async () => {
    const { user } = menu();

    const opened = await openMenu(user);

    const groups = within(opened).getAllByRole("group");
    expect(groups.map((group) => group.textContent)).toEqual([
      expect.stringMatching(/^Pull request web#31/),
      expect.stringMatching(/^Review/),
      "Delete review…",
    ]);
    expect(within(opened).getByRole("separator")).toBeInTheDocument();
  });

  it("opens the pull request on GitHub", async () => {
    const { user } = menu({ url: "https://github.com/dev/web/pull/31" });
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Open PR" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/31");
  });

  it("reads the pull request again out of the minute", async () => {
    const { user } = menu();
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Refresh PR" }));

    expect(api.refreshReviewPR).toHaveBeenCalledWith("review-1");
  });

  it("opens the worktree in VS Code, with its key", async () => {
    const { user } = menu();
    await openMenu(user);

    const item = screen.getByRole("menuitem", { name: /^Open in VS Code/ });
    expect(item).toHaveTextContent("Ctrl+E");
    await user.click(item);

    expect(api.openReviewInEditor).toHaveBeenCalledWith("review-1");
  });

  it("leaves VS Code disabled, with the reason, before the worktree exists", async () => {
    const { user } = menu({ worktreePath: "" });
    await openMenu(user);

    const item = screen.getByRole("menuitem", { name: /^Open in VS Code/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("the worktree doesn't exist yet");
  });

  it("asks for another pass in a dialog", async () => {
    const { user } = menu({ canReviewAgain: true });
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Review again…" }));

    expect(await screen.findByRole("heading", { name: "Review again" })).toBeInTheDocument();
  });

  it("disables Review again… with what holds it back", async () => {
    const { user } = menu({ canReviewAgain: false, status: "waiting_checks" });
    await openMenu(user);

    const item = screen.getByRole("menuitem", { name: /^Review again…/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("a pass waits for the checks");
  });

  it("asks before deleting the review", async () => {
    const { user } = menu();
    await openMenu(user);

    await user.click(screen.getByRole("menuitem", { name: "Delete review…" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete the review of web#31?");
    expect(api.deleteReview).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Delete review" }));
    expect(api.deleteReview).toHaveBeenCalledWith("review-1");
  });
});
