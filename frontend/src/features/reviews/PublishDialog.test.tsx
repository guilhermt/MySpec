import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublishDialog } from "@/features/reviews/PublishDialog";
import { api, type ReviewSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeReviewFinding, makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

// A pass with an approved finding on a line, one approved general finding and one the user discarded.
const DECIDED = makeReviewPass({
  summary: "Two things to fix before the merge.",
  findings: [
    makeReviewFinding({ number: 1, decision: "approved" }),
    makeReviewFinding({ number: 2, path: "", line: 0, decision: "approved" }),
    makeReviewFinding({ number: 3, decision: "discarded" }),
  ],
});

function dialog(
  overrides: Partial<ReviewSummary> = {},
  ui: Parameters<typeof renderWithStore>[1] = {},
) {
  const review = makeReviewSummary({ passes: [DECIDED], canPublish: true, ...overrides });
  const onOpenChange = vi.fn();
  const onReviewAgain = vi.fn();
  const view = renderWithStore(
    <PublishDialog
      review={review}
      open
      onOpenChange={onOpenChange}
      onReviewAgain={onReviewAgain}
    />,
    { state: makeState({ reviews: [review] }), ...ui },
  );
  return { ...view, onOpenChange, onReviewAgain, review };
}

const publishButton = () => screen.getByRole("button", { name: /^Publish/ });

describe("PublishDialog", () => {
  it("names the review and opens on Cancel with no verdict chosen", async () => {
    dialog();

    expect(
      screen.getByRole("dialog", { name: "Publish the review of web#31" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    for (const name of ["Request changes", "Approve", "Comment"]) {
      expect(screen.getByRole("radio", { name: new RegExp(name) })).toHaveAttribute(
        "aria-checked",
        "false",
      );
    }
    expect(publishButton()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Choose a verdict")).toBeInTheDocument();
  });

  it("says what goes to GitHub and suggests what the decisions ask for", () => {
    dialog();

    expect(
      screen.getByText(
        "1 inline comment · 1 finding and the summary in the body · 1 finding discarded, not published",
      ),
    ).toBeInTheDocument();
    const suggested = within(screen.getByRole("radio", { name: /Request changes/ }));
    expect(suggested.getByText("Suggested")).toBeInTheDocument();
    expect(
      within(screen.getByRole("radio", { name: /Approve/ })).queryByText("Suggested"),
    ).not.toBeInTheDocument();
  });

  it("chooses a verdict with the digits and the arrows, and publishes with it", async () => {
    const { user, onOpenChange } = dialog();

    await user.keyboard("1");
    expect(screen.getByRole("radio", { name: /Request changes/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(publishButton()).toHaveAccessibleName(/Publish · Request changes/);

    await user.keyboard("3");
    expect(screen.getByRole("radio", { name: /Comment/ })).toHaveAttribute("aria-checked", "true");

    await user.click(publishButton());

    expect(api.publishReview).toHaveBeenCalledWith("review-1", "comment", true);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("publishes from the keyboard with Ctrl+Enter only once a verdict is chosen", async () => {
    const { user } = dialog();

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(api.publishReview).not.toHaveBeenCalled();

    await user.keyboard("2");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.publishReview).toHaveBeenCalledWith("review-1", "approve", true);
  });

  it("takes only Comment on a pull request of the user's own, already chosen", () => {
    dialog({ own: true, verdicts: ["comment"] });

    expect(screen.getByRole("radio", { name: /Comment/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Approve/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("Your own pull request: GitHub takes only Comment.")).toHaveLength(
      2,
    );
    expect(screen.queryByText("Suggested")).not.toBeInTheDocument();
    expect(publishButton()).toHaveAccessibleName(/Publish · Comment/);
  });

  it("leaves only Approve when nothing is approved and the summary is left out", async () => {
    const { user } = dialog({ passes: [makeReviewPass({ findings: [makeReviewFinding()] })] });

    await user.click(screen.getByRole("checkbox", { name: "Include the summary" }));

    expect(screen.getByRole("radio", { name: /Approve/ })).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getAllByText("Without a summary and an approved finding, GitHub takes only Approve."),
    ).toHaveLength(2);
    expect(screen.getByText("No finding approved · the verdict only")).toBeInTheDocument();
    expect(screen.getByText("The review carries the verdict only.")).toBeInTheDocument();
  });

  it("takes nothing on a pull request of the user's own with nothing to send", async () => {
    const { user } = dialog({
      own: true,
      passes: [makeReviewPass({ findings: [makeReviewFinding()] })],
    });

    await user.click(screen.getByRole("checkbox", { name: "Include the summary" }));

    expect(screen.getByText("Nothing GitHub takes yet")).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-disabled", "true");
    }
    expect(publishButton()).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the start of the summary, or that it is empty, and publishes without it when unchecked", async () => {
    const { user } = dialog();

    expect(screen.getByText("Two things to fix before the merge.")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Include the summary" }));
    expect(
      screen.getByText("The review carries the verdict and the comments only."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();

    await user.keyboard("1");
    await user.click(publishButton());

    expect(api.publishReview).toHaveBeenCalledWith("review-1", "request_changes", false);
  });

  it("says the summary is empty", () => {
    dialog({ passes: [makeReviewPass({ summary: " ", findings: DECIDED.findings ?? [] })] });

    expect(screen.getByText("The summary is empty.")).toBeInTheDocument();
  });

  it("edits the summary in place, saves it, and closes the edit on Esc before the dialog", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const field = screen.getByRole("textbox", { name: "Summary" });
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("rows", "5");

    await user.clear(field);
    await user.type(field, "One 1 left.");
    expect(screen.getByRole("radio", { name: /Request changes/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "Summary" })).not.toBeInTheDocument();
    expect(screen.getByText("One 1 left.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("saves the summary before it publishes", async () => {
    const { user } = dialog();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("textbox", { name: "Summary" }));
    await user.type(screen.getByRole("textbox", { name: "Summary" }), "One thing left.");

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(api.publishReview).not.toHaveBeenCalled();
    await user.keyboard("{Escape}2");
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => expect(api.publishReview).toHaveBeenCalled());
    expect(api.setReviewSummary).toHaveBeenCalledWith("review-1", 1, "One thing left.");
  });

  it("shows a failed publication in the footer and keeps the attempt for the next opening", async () => {
    vi.mocked(api.publishReview).mockRejectedValueOnce(
      new Error("Couldn't publish to GitHub: no."),
    );
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("checkbox", { name: "Include the summary" }));
    await user.keyboard("1");
    await user.click(publishButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't publish to GitHub: no.");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(useAppStore.getState().publishAttempts["review-1"]).toEqual({
      pass: 1,
      verdict: "request_changes",
      withSummary: false,
    });
  });

  it("opens again on the verdict and the box of the attempt that failed on the same pass", () => {
    dialog(
      {},
      {
        ui: {
          publishAttempts: { "review-1": { pass: 1, verdict: "comment", withSummary: false } },
        },
      },
    );

    expect(screen.getByRole("radio", { name: /Comment/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Include the summary" })).not.toBeChecked();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ignores an attempt of another pass", () => {
    dialog(
      {},
      {
        ui: {
          publishAttempts: { "review-1": { pass: 4, verdict: "comment", withSummary: false } },
        },
      },
    );

    expect(screen.getByRole("radio", { name: /Comment/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("checkbox", { name: "Include the summary" })).toBeChecked();
  });

  it("forgets the attempt when the publication goes through", async () => {
    const { user } = dialog(
      {},
      {
        ui: { publishAttempts: { "review-1": { pass: 1, verdict: "comment", withSummary: true } } },
      },
    );

    await user.click(publishButton());

    await waitFor(() => expect(useAppStore.getState().publishAttempts).toEqual({}));
  });

  it("keeps Cancel and Esc still while it publishes", async () => {
    let finish: () => void = () => undefined;
    vi.mocked(api.publishReview).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { user, onOpenChange } = dialog();
    await user.keyboard("2");
    await user.click(publishButton());

    expect(await screen.findByRole("button", { name: "Publishing…" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");

    finish();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("warns about the commits that arrived and offers another pass instead", async () => {
    const { user, onReviewAgain, onOpenChange } = dialog({ stalePass: true, staleCommits: 2 });

    expect(
      screen.getByText(
        "2 commits arrived after this pass. Findings on lines that left the diff go in the review body.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review again instead" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onReviewAgain).toHaveBeenCalledOnce();
  });

  it("says nothing of commits when the pull request did not move", () => {
    dialog();

    expect(screen.queryByText(/arrived after this pass/)).not.toBeInTheDocument();
  });

  it("has one primary button", () => {
    dialog();

    expect(
      screen.getByRole("dialog").querySelectorAll("button[data-variant=primary]"),
    ).toHaveLength(1);
  });
});
