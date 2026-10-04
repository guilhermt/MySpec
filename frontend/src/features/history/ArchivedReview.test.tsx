import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArchivedReview } from "@/features/history/ArchivedReview";
import { olderKey } from "@/lib/history";
import { type ArchivedReview as ArchivedReviewItem, api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedReview,
  makeReviewFinding,
  makeReviewPass,
  makeState,
} from "@/test/wails-mock";

const PUBLISHED = makeReviewPass({
  pass: 2,
  file: "review-2.md",
  published: true,
  publishedAt: "2026-09-17T09:00:00Z",
  publishedUrl: "https://github.com/dev/web/pull/31#pullrequestreview-1",
  verdict: "request_changes",
  findings: [
    makeReviewFinding({ title: "Missing guard", decision: "approved", placement: "inline" }),
    makeReviewFinding({
      number: 2,
      title: "Split the migration",
      path: "",
      line: 0,
      text: "Split the migration.",
      decision: "approved",
      placement: "body",
    }),
    makeReviewFinding({ number: 3, title: "Rename the hook", decision: "discarded" }),
  ],
});

function view(overrides: Partial<ArchivedReviewItem> = {}, ui = {}) {
  const review = makeArchivedReview(overrides);
  return renderWithStore(<ArchivedReview reviewId={review.id} />, {
    state: makeState({ reviewHistory: [review] }),
    ui: { location: { kind: "archived-review", id: review.id }, ...ui },
  });
}

describe("ArchivedReview", () => {
  it("names the pull request, says what became of it and opens it on GitHub", async () => {
    const { user } = view({ outcome: "closed" });

    expect(
      screen.getByRole("heading", { level: 1, name: "Add the login screen" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Closed", { selector: "span" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open on GitHub" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/31");
  });

  it("says which pull request Open on GitHub opens in its tooltip", async () => {
    const { user } = view();

    await user.hover(screen.getByRole("button", { name: "Open on GitHub" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Open web#31 on GitHub");
  });

  it("puts the focus on the title on arrival", async () => {
    view({}, { pendingFocus: "title" });

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "Add the login screen" })).toHaveFocus(),
    );
  });

  it("says the facts, the pull request as a link", async () => {
    const { user } = view({ passes: [PUBLISHED] });

    const facts = screen.getByText("Pull request", { selector: "dt" }).closest("dl");
    expect(facts).toHaveTextContent("web#31 by alice · merged into dev");
    expect(facts).toHaveTextContent("1 pass, published");
    await user.click(within(facts as HTMLElement).getByRole("link", { name: "web#31" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/31");
  });

  it("shows each pass with its verdict, the findings that left and its report in place", async () => {
    vi.mocked(api.readReviewArtifact).mockImplementation((_id, name) =>
      Promise.resolve(`## Report of ${name}`),
    );
    const { user } = view({
      passes: [makeReviewPass(), PUBLISHED, makeReviewPass({ pass: 3, recorded: false, file: "" })],
    });

    const first = screen.getByRole("region", { name: "Pass 1" });
    expect(within(first).getByText("not published")).toBeInTheDocument();
    const second = screen.getByRole("region", { name: "Pass 2" });
    expect(within(second).getByText("Request changes")).toBeInTheDocument();
    expect(within(second).getByText(/^published Sep 17/)).toBeInTheDocument();
    expect(within(second).getByText("Missing guard")).toBeInTheDocument();
    expect(within(second).getByText("Split the migration")).toBeInTheDocument();
    expect(within(second).queryByText("Rename the hook")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Pass 3" })).not.toBeInTheDocument();

    await user.click(within(second).getByRole("button", { name: "Report · review-2.md" }));

    await waitFor(() =>
      expect(within(second).getAllByTestId("markdown").at(-1)).toHaveTextContent(
        "Report of review-2.md",
      ),
    );
    expect(api.readReviewArtifact).toHaveBeenCalledWith("review-1", "review-2.md");
    expect(screen.queryByRole("button", { name: /^Open in/ })).not.toBeInTheDocument();
  });

  it("lists the findings that left a pass closed, each opening the text that went", async () => {
    const { user } = view({ passes: [PUBLISHED] });

    const findings = screen.getByRole("list", { name: "Findings of pass 2" });
    expect(
      within(findings)
        .getAllByRole("button")
        .map((line) => line.textContent),
    ).toEqual([
      "Missing guardsrc/login.ts:12Inline comment",
      "Split the migrationGeneral · not on a line of the diffIn the review body",
    ]);
    expect(within(findings).queryByText("Split the migration.")).not.toBeInTheDocument();

    await user.click(within(findings).getByRole("button", { name: /^Split the migration/ }));

    expect(within(findings).getByText("Split the migration.")).toBeInTheDocument();
  });

  it("says no report was written, and that the conversation isn't kept", () => {
    view({ passes: [makeReviewPass({ recorded: false, file: "" })] });

    expect(screen.getByText("No report was written.")).toBeInTheDocument();
    expect(
      screen.getByText("The conversation of a review isn't kept in History."),
    ).toBeInTheDocument();
  });

  it("shows the skeleton of a review that isn't there yet", () => {
    renderWithStore(<ArchivedReview reviewId="review-9" />, {
      state: makeState(),
      ui: {
        location: { kind: "archived-review", id: "review-9" },
        archivedLookups: { "review-9": "loading" },
      },
    });

    expect(screen.getByRole("status", { name: "Reading the review" })).toBeInTheDocument();
  });
});

describe("ArchivedReview, Delete…", () => {
  async function openDialog() {
    const rendered = view();
    await rendered.user.click(screen.getByRole("button", { name: "More actions" }));
    await rendered.user.click(await screen.findByRole("menuitem", { name: "Delete…" }));
    return rendered;
  }

  it("opens the confirmation of the archived review on Cancel and gives the focus back to the ⋯", async () => {
    const { user } = await openDialog();

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", { name: "Delete the review of web#31?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "This removes the archived review and its reports from History. It can't be undone.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
    await user.tab();
    await user.tab();
    await user.tab();
    await expect.poll(() => dialog.contains(document.activeElement)).toBe(true);

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus());
    expect(api.deleteReview).not.toHaveBeenCalled();
  });

  it("deletes the review and goes back to History with the focus on the row that took its place", async () => {
    const newer = makeArchivedReview({ id: "review-1", archivedAt: "2026-09-09T10:00:00Z" });
    const older = makeArchivedReview({ id: "review-2", archivedAt: "2026-09-08T10:00:00Z" });
    const { user } = renderWithStore(<ArchivedReview reviewId="review-1" />, {
      state: makeState({ reviewHistory: [] }),
      ui: {
        location: { kind: "archived-review", id: "review-1" },
        olderArchived: {
          tasks: {},
          reviews: { "review-1": newer, "review-2": older },
          discussions: {},
        },
        olderLists: {
          [olderKey("", "")]: {
            ids: ["review-1", "review-2"],
            next: null,
            matched: 2,
            status: "idle",
            error: "",
          },
        },
      },
    });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete…" }));

    await user.click(await screen.findByRole("button", { name: "Delete review" }));

    await waitFor(() => expect(useAppStore.getState().location).toEqual({ kind: "history" }));
    expect(api.deleteReview).toHaveBeenCalledWith("review-1");
    expect(useAppStore.getState().historyFocus).toBe("review-2");
  });
});
