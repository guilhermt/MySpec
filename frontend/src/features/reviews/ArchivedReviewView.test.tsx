import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArchivedReviewView } from "@/features/reviews/ArchivedReviewView";
import { type ArchivedReview, api } from "@/lib/wails";
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
    makeReviewFinding({ decision: "approved", placement: "inline" }),
    makeReviewFinding({
      number: 2,
      path: "",
      line: 0,
      text: "Split the migration.",
      decision: "approved",
      placement: "body",
    }),
    makeReviewFinding({ number: 3, text: "Rename the hook.", decision: "discarded" }),
  ],
});

function view(overrides: Partial<ArchivedReview> = {}) {
  return renderWithStore(<ArchivedReviewView reviewId="review-1" />, {
    state: makeState({ reviewHistory: [makeArchivedReview(overrides)] }),
    ui: { location: { kind: "archived-review", id: "review-1" } },
  });
}

describe("ArchivedReviewView", () => {
  it("names the pull request, its repository, its author and what became of it", () => {
    view({ outcome: "closed" });

    expect(screen.getByText("#31")).toBeInTheDocument();
    expect(screen.getByText("Add the login screen")).toBeInTheDocument();
    expect(screen.getByText("dev/web")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("renders the report of every recorded pass", async () => {
    vi.mocked(api.readReviewArtifact).mockImplementation((_id, name) =>
      Promise.resolve(`## Report of ${name}`),
    );
    view({ passes: [makeReviewPass(), PUBLISHED, makeReviewPass({ pass: 3, recorded: false })] });

    const [first, second] = await screen.findAllByTestId("markdown");
    expect(first).toHaveTextContent("Report of review-1.md");
    expect(second).toHaveTextContent("Report of review-2.md");
    expect(api.readReviewArtifact).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: "Review 1 · changes" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Review 2 · changes · published" }),
    ).toBeInTheDocument();
  });

  it("lists what a published pass sent to GitHub, and where each finding went", () => {
    view({ passes: [PUBLISHED] });

    expect(screen.getByText(/^Published · Request changes ·/)).toBeInTheDocument();
    const sent = screen.getByRole("list", { name: "Published findings of review 2" });
    const [inline, body] = within(sent).getAllByRole("listitem");
    expect(inline).toHaveTextContent("src/login.ts:12");
    expect(inline).toHaveTextContent("Inline comment");
    expect(inline).toHaveTextContent("The token is never cleared.");
    expect(body).toHaveTextContent("General");
    expect(body).toHaveTextContent("In the review body");
    expect(within(sent).queryByText("Rename the hook.")).not.toBeInTheDocument();
  });

  it("says when the review never produced a report", () => {
    view({ passes: [] });

    expect(screen.getByText("No report was written.")).toBeInTheDocument();
  });

  it("opens the pull request on GitHub", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Open on GitHub" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/31");
  });

  it("goes back to the history", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "← History" }));

    expect(useAppStore.getState().location).toEqual({ kind: "history" });
  });

  it("deletes the review once confirmed", async () => {
    const { user } = view();

    await user.click(screen.getByRole("button", { name: "Delete review" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(api.deleteReview).toHaveBeenCalledWith("review-1");
  });

  it("shows nothing for a review the history no longer has", () => {
    const { container } = renderWithStore(<ArchivedReviewView reviewId="review-9" />, {
      state: makeState({ reviewHistory: [makeArchivedReview()] }),
    });

    expect(container.querySelector("header")).toBeNull();
  });
});
