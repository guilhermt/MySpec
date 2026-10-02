import { act, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FindingsCard, type FindingsCardProps } from "@/components/FindingsCard";
import { Markdown } from "@/features/chat/Markdown";
import { leaveDecisionCard } from "@/features/chat/useFeed";
import { EDIT_NOTES, findingViews } from "@/features/reviews/review-conversation";
import { passRevision } from "@/features/reviews/useFindingText";
import { api, type ReviewPass, type ReviewSummary } from "@/lib/wails";
import { decideFindingInPlace, openFindingInEditor, saveFindingTextInPlace } from "@/store/actions";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeReviewFinding, makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

const FINDINGS = [
  makeReviewFinding({ number: 1, title: "The token is never cleared" }),
  makeReviewFinding({
    number: 2,
    title: "No test for the expiry",
    path: "src/expiry.ts",
    line: 31,
    lineUrl: "https://github.com/dev/web/pull/31/files#diff-bR31",
    text: "There is **no test** for the expiry.",
  }),
  makeReviewFinding({ number: 3, title: "The copy is wrong", path: "", line: 0 }),
];

// cardOf mounts the card as the review does: by the props the pass and the review give.
function cardOf(
  review: ReviewSummary,
  pass: ReviewPass,
  disabled = false,
): React.ReactElement<FindingsCardProps> {
  return (
    <FindingsCard
      owner={review.id}
      pass={pass.pass}
      revision={pass.revision}
      currentRevision={() => passRevision(review.id, pass.pass)}
      findings={pass.findings ?? []}
      views={findingViews(review, pass, Date.now(), disabled)}
      editNote={EDIT_NOTES[review.mode === "apply" ? "apply" : "publish"]}
      disabled={disabled}
      decide={(number, decision) => decideFindingInPlace(review.id, pass.pass, number, decision)}
      saveText={(number, text) => saveFindingTextInPlace(review.id, pass.pass, number, text)}
      openEditor={(number) => void openFindingInEditor(review.id, pass.pass, number)}
      renderText={(text) => <Markdown cutCode>{text}</Markdown>}
      onLeave={leaveDecisionCard}
    />
  );
}

function card(
  pass: Partial<ReviewPass> = {},
  review: Partial<ReviewSummary> = {},
  disabled = false,
) {
  const made = makeReviewPass({ findings: FINDINGS, ...pass });
  const summary = makeReviewSummary({ passes: [made], status: "awaiting_decision", ...review });
  const view = renderWithStore(cardOf(summary, made, disabled), {
    state: makeState({ reviews: [summary] }),
  });
  return { ...view, review: summary, pass: made };
}

const finding = (number: number) =>
  screen.getByRole("group", { name: new RegExp(`^Finding ${number} of `) });

describe("FindingsCard", () => {
  it("draws the findings of the pass in the order of the report, with their titles", () => {
    card();

    const group = screen.getByRole("group", { name: "Findings of pass 1" });
    const findings = within(group).getAllByRole("group", { name: /^Finding / });
    expect(findings.map((each) => each.getAttribute("aria-label"))).toEqual([
      "Finding 1 of 3: The token is never cleared. src/login.ts, line 12. Not decided.",
      "Finding 2 of 3: No test for the expiry. src/expiry.ts, line 31. Not decided.",
      "Finding 3 of 3: The copy is wrong. General. Not decided.",
    ]);
    expect(within(group).getByText("General · not on a line of the diff")).toBeInTheDocument();
  });

  it("records an approval or a discard with the buttons, and takes a decision back with the same one", async () => {
    const { user } = card({
      findings: [makeReviewFinding({ number: 1, decision: "approved" }), ...FINDINGS.slice(1)],
    });

    await user.click(within(finding(2)).getByRole("button", { name: "Discard" }));
    await user.click(within(finding(1)).getByRole("button", { name: "Approve" }));

    expect(api.decideFinding).toHaveBeenNthCalledWith(1, "review-1", 1, 2, "discarded");
    expect(api.decideFinding).toHaveBeenNthCalledWith(2, "review-1", 1, 1, "");
  });

  it("decides with A and D and takes the focus to the next finding to decide", async () => {
    const { user } = card({
      findings: [
        makeReviewFinding({ number: 1 }),
        makeReviewFinding({ number: 2, decision: "approved" }),
        makeReviewFinding({ number: 3 }),
      ],
    });

    finding(1).focus();
    await user.keyboard("a");

    expect(api.decideFinding).toHaveBeenCalledWith("review-1", 1, 1, "approved");
    expect(finding(3)).toHaveFocus();

    await user.keyboard("d");

    expect(api.decideFinding).toHaveBeenLastCalledWith("review-1", 1, 3, "discarded");
  });

  it("takes a decision back with the same key and stays where it is", async () => {
    const { user } = card({
      findings: [
        makeReviewFinding({ number: 1, decision: "discarded" }),
        makeReviewFinding({ number: 2 }),
      ],
    });

    finding(1).focus();
    await user.keyboard("d");

    expect(api.decideFinding).toHaveBeenCalledWith("review-1", 1, 1, "");
    expect(finding(1)).toHaveFocus();
  });

  it("says where a decision failed, on the finding and not in the notice, and tries it again", async () => {
    vi.mocked(api.decideFinding).mockRejectedValueOnce(new Error("pass is over"));
    const { user } = card();

    await user.click(within(finding(1)).getByRole("button", { name: "Approve" }));

    expect(await within(finding(1)).findByText(/Couldn't save the decision/)).toBeInTheDocument();
    expect(useAppStore.getState().error).toBeNull();

    await user.click(within(finding(1)).getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(api.decideFinding).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(within(finding(1)).queryByText(/Couldn't save/)).not.toBeInTheDocument(),
    );
  });

  it("opens the line on GitHub with O and in the editor with Ctrl+E", async () => {
    const { user } = card();

    finding(2).focus();
    await user.keyboard("o");
    await user.keyboard("{Control>}e{/Control}");

    expect(api.openExternal).toHaveBeenCalledWith(
      "https://github.com/dev/web/pull/31/files#diff-bR31",
    );
    expect(api.openFindingInEditor).toHaveBeenCalledWith("review-1", 1, 2);
  });

  it("does not open a line for a finding that is on none", async () => {
    const { user } = card();

    finding(3).focus();
    await user.keyboard("o");
    await user.keyboard("{Control>}e{/Control}");

    expect(api.openExternal).not.toHaveBeenCalled();
    expect(api.openFindingInEditor).not.toHaveBeenCalled();
  });

  describe("a card behind", () => {
    it("decides and edits nothing, and says where each finding went", async () => {
      const { user } = card(
        {
          sent: true,
          sentAt: "2026-09-27T17:36:00Z",
          findings: [
            makeReviewFinding({ number: 1, decision: "approved" }),
            makeReviewFinding({ number: 2, decision: "discarded" }),
          ],
        },
        { mode: "apply" },
        true,
      );

      expect(within(finding(1)).getByText(/^Sent to the agent/)).toBeInTheDocument();
      expect(within(finding(2)).getByText("Not sent")).toBeInTheDocument();
      expect(within(finding(1)).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
      expect(within(finding(1)).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();

      finding(1).focus();
      await user.keyboard("d");
      await user.keyboard("e");

      expect(api.decideFinding).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  describe("editing the text", () => {
    it("opens the raw text with E, saves what is typed as the field is left, and closes with Done", async () => {
      const { user } = card();

      finding(2).focus();
      await user.keyboard("e");
      const field = screen.getByRole("textbox", { name: "Text of finding 2" });
      expect(field).toHaveFocus();
      expect(field).toHaveValue("There is **no test** for the expiry.");
      expect(
        screen.getByText("Saved as you type. It goes to GitHub as you leave it."),
      ).toBeInTheDocument();

      await user.clear(field);
      await user.type(field, "Cover the expiry.");
      await user.click(screen.getByRole("button", { name: "Done" }));

      expect(api.setFindingText).toHaveBeenCalledWith("review-1", 1, 2, "Cover the expiry.");
      expect(screen.queryByRole("textbox", { name: "Text of finding 2" })).not.toBeInTheDocument();
      expect(finding(2)).toHaveFocus();
    });

    it("tells the apply mode that the text goes to the agent", async () => {
      const { user } = card({}, { mode: "apply" });

      await user.click(within(finding(1)).getByRole("button", { name: "Edit" }));

      expect(
        screen.getByText("Saved as you type. It goes to the agent as you leave it."),
      ).toBeInTheDocument();
    });

    it("closes with Esc, and never saves a finding left empty", async () => {
      const { user } = card();

      await user.click(within(finding(1)).getByRole("button", { name: "Edit" }));
      const field = screen.getByRole("textbox", { name: "Text of finding 1" });
      await user.clear(field);

      expect(screen.getByText("Write the finding, or discard it.")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("textbox", { name: "Text of finding 1" })).not.toBeInTheDocument();
      expect(api.setFindingText).not.toHaveBeenCalled();
    });

    it("says where a text failed to save", async () => {
      vi.mocked(api.setFindingText).mockRejectedValueOnce(new Error("pass is over"));
      const { user } = card();

      await user.click(within(finding(1)).getByRole("button", { name: "Edit" }));
      await user.type(screen.getByRole("textbox", { name: "Text of finding 1" }), " Now.");
      await user.click(screen.getByRole("button", { name: "Done" }));

      expect(await within(finding(1)).findByText(/Couldn't save the text/)).toBeInTheDocument();
    });

    it("keeps a failed decision when the text saves, and tries the decision again", async () => {
      vi.mocked(api.decideFinding).mockRejectedValueOnce(new Error("pass is over"));
      const { user } = card();

      await user.click(within(finding(1)).getByRole("button", { name: "Approve" }));
      expect(await within(finding(1)).findByText(/Couldn't save the decision/)).toBeInTheDocument();

      await user.click(within(finding(1)).getByRole("button", { name: "Edit" }));
      await user.type(screen.getByRole("textbox", { name: "Text of finding 1" }), " Now.");
      await user.click(screen.getByRole("button", { name: "Done" }));
      await waitFor(() => expect(api.setFindingText).toHaveBeenCalled());

      expect(within(finding(1)).getByText(/Couldn't save the decision/)).toBeInTheDocument();
      await user.click(within(finding(1)).getByRole("button", { name: "Try again" }));
      expect(api.decideFinding).toHaveBeenLastCalledWith("review-1", 1, 1, "approved");
    });

    it("keeps saving while the decision is under way, though the text already saved", async () => {
      let settle: () => void = () => {};
      vi.mocked(api.decideFinding).mockReturnValueOnce(
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
      );
      const { user } = card();

      await user.click(within(finding(1)).getByRole("button", { name: "Approve" }));
      await user.click(within(finding(1)).getByRole("button", { name: "Edit" }));
      await user.type(screen.getByRole("textbox", { name: "Text of finding 1" }), " Now.");
      await user.click(screen.getByRole("button", { name: "Done" }));
      await waitFor(() => expect(api.setFindingText).toHaveBeenCalled());

      expect(within(finding(1)).getByText("Saving…")).toBeInTheDocument();
      await act(async () => settle());
      await waitFor(() =>
        expect(within(finding(1)).queryByText("Saving…")).not.toBeInTheDocument(),
      );
    });
  });

  describe("a report written again", () => {
    // rewrite is the same pass after the agent wrote its report again: a new revision, with the
    // findings it gives.
    function rewrite(view: ReturnType<typeof card>, findings: ReviewPass["findings"]) {
      const pass = makeReviewPass({ findings, revision: 2 });
      const review = makeReviewSummary({ passes: [pass], status: "awaiting_decision" });
      act(() => useAppStore.getState().applyState(makeState({ reviews: [review] })));
      view.rerender(cardOf(review, pass));
    }

    it("keeps the editing open of a finding that did not change, and closes that of one that did", async () => {
      const view = card();
      await view.user.click(within(finding(1)).getByRole("button", { name: "Edit" }));
      await view.user.click(within(finding(2)).getByRole("button", { name: "Edit" }));
      expect(screen.getAllByRole("textbox")).toHaveLength(2);

      rewrite(view, [
        FINDINGS[0] as NonNullable<ReviewPass["findings"]>[number],
        { ...(FINDINGS[1] as NonNullable<ReviewPass["findings"]>[number]), text: "Rewritten." },
        FINDINGS[2] as NonNullable<ReviewPass["findings"]>[number],
      ]);

      expect(screen.getByRole("textbox", { name: "Text of finding 1" })).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Text of finding 2" })).not.toBeInTheDocument();
      expect(within(finding(2)).getByText("Rewritten.")).toBeInTheDocument();
    });
  });
});
