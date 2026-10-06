import { act, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportsPanel } from "@/features/reviews/ReportsPanel";
import { api, type ReviewSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, type StoreOptions } from "@/test/render";
import { makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

function panel(overrides: Partial<ReviewSummary> = {}, ui: NonNullable<StoreOptions["ui"]> = {}) {
  const review = makeReviewSummary({ passes: [makeReviewPass()], ...overrides });
  return renderWithStore(<ReportsPanel review={review} />, {
    state: makeState({ reviews: [review] }),
    ui,
  });
}

describe("ReportsPanel", () => {
  it("is the aside Reports, closed by ×", async () => {
    const { user } = panel({}, { panel: "reports" });

    await user.click(
      within(screen.getByRole("complementary", { name: "Reports" })).getByRole("button", {
        name: "Close",
      }),
    );

    expect(useAppStore.getState().panel).toBeNull();
  });

  it("lists the context and every pass that was recorded", () => {
    panel({
      passes: [
        makeReviewPass({ pass: 1, published: true, verdict: "comment" }),
        makeReviewPass({ pass: 2, file: "review-2.md", clean: true }),
        makeReviewPass({ pass: 3, file: "review-3.md", recorded: false }),
      ],
    });

    expect(screen.getByRole("button", { name: "Context" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review 1 · changes · published" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review 2 · clean" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Review 3/ })).not.toBeInTheDocument();
  });

  it("opens a report and comes back to the list", async () => {
    const { user } = panel();

    await user.click(screen.getByRole("button", { name: "Review 1 · changes" }));

    expect(api.readReviewArtifact).toHaveBeenCalledWith("review-1", "review-1.md");
    expect(await screen.findByTestId("markdown")).toHaveTextContent("Findings");

    await user.click(screen.getByRole("button", { name: "← Reports" }));
    expect(screen.getByRole("button", { name: "Context" })).toBeInTheDocument();
  });

  it("opens the context the agent was given", async () => {
    const { user } = panel();

    await user.click(screen.getByRole("button", { name: "Context" }));

    expect(api.readReviewArtifact).toHaveBeenCalledWith("review-1", "context.md");
  });

  it("reads the context again once another pass is asked for", async () => {
    const review = makeReviewSummary({ passes: [makeReviewPass()] });
    const { user, rerender } = renderWithStore(<ReportsPanel review={review} />, {
      state: makeState({ reviews: [review] }),
    });
    await user.click(screen.getByRole("button", { name: "Context" }));
    expect(api.readReviewArtifact).toHaveBeenCalledOnce();

    const asked = {
      ...review,
      passes: [makeReviewPass(), makeReviewPass({ pass: 2, file: "review-2.md", recorded: false })],
    };
    rerender(<ReportsPanel review={asked} />);

    expect(api.readReviewArtifact).toHaveBeenCalledTimes(2);
    expect(api.readReviewArtifact).toHaveBeenLastCalledWith("review-1", "context.md");
  });

  it("focuses the way back in a report, and its row on the way back", async () => {
    const { user } = panel();

    await user.click(screen.getByRole("button", { name: "Review 1 · changes" }));
    expect(screen.getByRole("button", { name: "← Reports" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "← Reports" }));
    expect(screen.getByRole("button", { name: "Review 1 · changes" })).toHaveFocus();
  });

  it("opens at the report a pass of Details asked for, also with the panel already open", async () => {
    const review = makeReviewSummary({
      passes: [makeReviewPass(), makeReviewPass({ pass: 2, file: "review-2.md" })],
    });
    renderWithStore(<ReportsPanel review={review} />, {
      state: makeState({ reviews: [review] }),
    });
    expect(screen.getByRole("button", { name: "Context" })).toBeInTheDocument();

    act(() => useAppStore.getState().openPanelAt("reports", "review-2.md"));

    expect(await screen.findByRole("heading", { name: "Review 2 · changes" })).toBeInTheDocument();
    expect(api.readReviewArtifact).toHaveBeenCalledWith("review-1", "review-2.md");
    expect(useAppStore.getState().panelDocument).toBeNull();
  });

  it("opens at the context a marker asked for", async () => {
    panel({}, { panel: "reports", panelDocument: "context.md" });

    expect(await screen.findByRole("heading", { name: "Context" })).toBeInTheDocument();
    expect(api.readReviewArtifact).toHaveBeenCalledWith("review-1", "context.md");
  });

  it("falls back to the list for a document the review doesn't have", () => {
    panel({}, { panel: "reports", panelDocument: "review-7.md" });

    expect(screen.getByRole("button", { name: "Context" })).toBeInTheDocument();
  });

  it("says when a pass was published, and opens the review on GitHub", async () => {
    const { user } = panel({
      passes: [
        makeReviewPass({
          published: true,
          verdict: "request_changes",
          publishedAt: "2026-09-17T12:00:00Z",
          publishedUrl: "https://github.com/dev/web/pull/31#pullrequestreview-1",
        }),
      ],
    });

    await user.click(screen.getByRole("button", { name: /Review 1 · changes · published/ }));

    expect(await screen.findByText(/^Published · Request changes · /)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open on GitHub" }));
    expect(api.openExternal).toHaveBeenCalledWith(
      "https://github.com/dev/web/pull/31#pullrequestreview-1",
    );
  });

  it("shows a read that failed and reads again with Try again", async () => {
    vi.mocked(api.readReviewArtifact).mockRejectedValueOnce(new Error("No such file."));
    const { user } = panel();

    await user.click(screen.getByRole("button", { name: "Review 1 · changes" }));

    expect(await screen.findByText("No such file.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("Findings");
    expect(api.readReviewArtifact).toHaveBeenCalledTimes(2);
  });
});
