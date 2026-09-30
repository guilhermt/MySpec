import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewDetails } from "@/features/reviews/ReviewDetails";
import { api, type ReviewSummary, type State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeBoardCard,
  makePRCheck,
  makePullRequestRow,
  makeReviewCenter,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeState,
} from "@/test/wails-mock";

const CARD = {
  boardId: "board-1",
  number: 452,
  title: "Idempotency keys",
  url: "https://github.com/dev/web/issues/452",
  status: "In progress",
};

function details(overrides: Partial<ReviewSummary> = {}, app: Partial<State> = {}) {
  const review = makeReviewSummary({
    passes: [makeReviewPass()],
    createdAt: new Date().toISOString(),
    ...overrides,
  });
  return renderWithStore(<ReviewDetails review={review} />, {
    state: makeState({ reviews: [review], ...app }),
    ui: { panel: "details" },
  });
}

const section = (legend: string | RegExp) => screen.getByRole("region", { name: legend });

describe("ReviewDetails", () => {
  it("is the aside Details, closed by ×", async () => {
    const { user } = details();

    await user.click(
      within(screen.getByRole("complementary", { name: "Details" })).getByRole("button", {
        name: "Close",
      }),
    );

    expect(useAppStore.getState().panel).toBeNull();
  });

  it("says the pull request: its link, author, branch and, from the list, its labels", async () => {
    const { user } = details(
      {},
      {
        reviewCenter: makeReviewCenter({
          pullRequests: [
            makePullRequestRow({
              labels: [
                { name: "backend", color: "" },
                { name: "urgent", color: "" },
              ],
            }),
          ],
        }),
      },
    );
    const facts = section("Pull request");

    await user.click(within(facts).getByRole("link", { name: "dev/web#31" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/31");
    expect(facts).toHaveTextContent("alice");
    expect(facts).toHaveTextContent("add-login → dev");
    expect(facts).toHaveTextContent("backend, urgent");
  });

  it("leaves out the card and the labels it doesn't have", () => {
    details();

    const facts = section("Pull request");
    expect(within(facts).queryByText("Card")).not.toBeInTheDocument();
    expect(within(facts).queryByText("Labels")).not.toBeInTheDocument();
  });

  it("opens the card in the board when the reading of the board has it", async () => {
    const { user } = details(
      { card: CARD },
      {
        boards: [
          makeBoard({
            id: "board-1",
            cards: [makeBoardCard({ key: "dev/web#452", number: 452, url: CARD.url })],
          }),
        ],
      },
    );

    expect(
      within(section("Pull request")).getByText(/Idempotency keys · In progress/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "#452" }));

    expect(useAppStore.getState().boardCardRequest).toEqual({
      boardId: "board-1",
      key: "dev/web#452",
    });
  });

  it("opens the card on GitHub when the board doesn't have it", async () => {
    const { user } = details({ card: CARD });

    await user.click(screen.getByRole("link", { name: "#452" }));

    expect(api.openExternal).toHaveBeenCalledWith(CARD.url);
  });

  it("lists the checks read before each pass that kept them, the most recent first, by name", () => {
    const read = (hour: number) => new Date(2026, 8, 27, hour, 10).toISOString();
    details({
      passes: [
        makeReviewPass({
          pass: 1,
          checksReadAt: read(13),
          checks: [makePRCheck({ name: "lint" }), makePRCheck({ name: "unit" })],
        }),
        makeReviewPass({ pass: 2, file: "review-2.md" }),
        makeReviewPass({
          pass: 3,
          file: "review-3.md",
          checksReadAt: read(15),
          checks: [makePRCheck({ name: "e2e" })],
          mergeable: "mergeable",
        }),
      ],
    });

    const groups = screen
      .getAllByRole("region")
      .map((group) => group.getAttribute("aria-label"))
      .filter((label) => label?.startsWith("Checks read before"));
    expect(groups).toEqual([
      expect.stringMatching(/^Checks read before pass 3 · /),
      expect.stringMatching(/^Checks read before pass 1 · /),
    ]);
    expect(within(section(/pass 3/)).getByText("e2e")).toBeInTheDocument();
    expect(within(section(/pass 1/)).getByText("lint")).toBeInTheDocument();
    expect(within(section(/pass 1/)).getByText("unit")).toBeInTheDocument();
  });

  it("has no group of checks for a pass from before they were kept", () => {
    details({ passes: [makeReviewPass({ checksReadAt: "", checks: [] })] });

    expect(screen.queryByRole("region", { name: /^Checks read before/ })).not.toBeInTheDocument();
  });

  describe("Passes", () => {
    it("has a row per pass, with what became of it", () => {
      details({
        passes: [
          makeReviewPass({ pass: 1, published: true, findings: [makeReviewFinding()] }),
          makeReviewPass({ pass: 2, file: "review-2.md", clean: true, findings: [] }),
          makeReviewPass({ pass: 3, file: "review-3.md", recorded: false, findings: [] }),
        ],
      });

      const passes = section("Passes");
      const first = within(passes).getByRole("button", { name: /^Pass 1 · changes · 1 finding/ });
      expect(first).toHaveTextContent("published");
      expect(within(passes).getByText("Pass 2 · clean")).toBeInTheDocument();
      expect(within(passes).getByText("Pass 3 · no report yet")).toBeInTheDocument();
    });

    it("opens the report of a pass in Reports, in place of Details", async () => {
      const { user } = details({
        passes: [makeReviewPass(), makeReviewPass({ pass: 2, file: "review-2.md" })],
      });

      await user.click(
        within(section("Passes")).getByRole("button", { name: /^Pass 2 · changes/ }),
      );

      expect(useAppStore.getState().panel).toBe("reports");
      expect(useAppStore.getState().panelDocument).toBe("review-2.md");
    });

    it("opens nothing for a pass that has no report", () => {
      details({ passes: [makeReviewPass({ recorded: false, findings: [] })] });

      expect(within(section("Passes")).queryByRole("button")).not.toBeInTheDocument();
    });
  });

  it("says the review: its mode, fixed, the model, the worktree and when it started", () => {
    details({ mode: "apply" });

    const facts = section("Review");
    expect(facts).toHaveTextContent("Apply · fixed");
    expect(facts).toHaveTextContent("Opus 5.5 (1M) · high");
    expect(facts).toHaveTextContent("~/.local/share/myspec/worktrees/dev/web/pr_31");
    expect(facts).toHaveTextContent(/Started\s*Today \d{2}:\d{2}/);
  });

  it("leaves out the model and the worktree a review doesn't have yet", () => {
    details({ sessionModel: "", worktreePath: "" });

    const facts = section("Review");
    expect(within(facts).queryByText("Model")).not.toBeInTheDocument();
    expect(within(facts).queryByText("Worktree")).not.toBeInTheDocument();
  });
});
