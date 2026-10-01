import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { ReviewView } from "@/features/reviews/ReviewView";
import { api, type ReviewSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeEntry,
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
  makeTranscript,
} from "@/test/wails-mock";

const DECIDE = makeSituation({
  kind: "review_report",
  form: "",
  taskId: "review-1",
  place: { kind: "review", stage: "review", step: 0 },
});

const PUBLISH = makeSituation({ ...DECIDE, form: "publish" });

// A pass with three findings, the middle one decided.
const FINDINGS = [
  makeReviewFinding({ number: 1, title: "First" }),
  makeReviewFinding({ number: 2, title: "Second", decision: "approved" }),
  makeReviewFinding({ number: 3, title: "Third" }),
];

function screenOf(overrides: Partial<ReviewSummary> = {}) {
  const review = makeReviewSummary({
    status: "awaiting_decision",
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    passes: [makeReviewPass({ findings: FINDINGS })],
    situations: [DECIDE],
    ...overrides,
  });
  return renderWithStore(<ReviewView reviewId="review-1" />, {
    state: makeState({ reviews: [review] }),
    ui: { location: { kind: "review", id: "review-1" } },
  });
}

const finding = (number: number) =>
  screen.getByRole("group", { name: new RegExp(`^Finding ${number} of `) });

describe("ReviewView, the keys of the findings", () => {
  it("goes to the next finding to decide with Alt+↓ from the composer, and wraps", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    screen.getByRole("textbox", { name: "Reply to the reviewer" }).focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(finding(1)).toHaveFocus();

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(finding(3)).toHaveFocus();

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(finding(1)).toHaveFocus();
  });

  it("goes to the previous finding to decide with Alt+↑, and wraps", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(finding(3)).toHaveFocus();

    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(finding(1)).toHaveFocus();
  });

  it("stays where it is when nothing is left to decide", async () => {
    const { user } = screenOf({
      passes: [
        makeReviewPass({
          findings: FINDINGS.map((each) => makeReviewFinding({ ...each, decision: "approved" })),
        }),
      ],
    });
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(2).focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");

    expect(finding(2)).toHaveFocus();
  });

  it("does nothing without a card of findings on screen", async () => {
    const { user } = screenOf({
      status: "published",
      passes: [makeReviewPass({ published: true })],
    });
    await screen.findByRole("feed");

    const composer = screen.getByRole("textbox", { name: "Reply to the reviewer" });
    composer.focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");

    expect(composer).toHaveFocus();
  });

  it("does nothing while a dialog is open", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });
    useAppStore.getState().openReviewDialog("review-1", "again");
    const dialog = await screen.findByRole("dialog");

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");

    expect(dialog).toBeInTheDocument();
    expect(document.activeElement?.closest("[data-finding-id]")).toBeNull();
  });

  it("takes the focus to the next finding to decide from the bar, with Next to decide", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    await user.click(screen.getByRole("button", { name: "Next to decide" }));

    expect(finding(1)).toHaveFocus();
  });
});

describe("ReviewView, Ctrl+Enter", () => {
  const ready = {
    status: "ready_to_publish",
    canPublish: true,
    situations: [PUBLISH],
    passes: [
      makeReviewPass({
        findings: FINDINGS.map((each) => makeReviewFinding({ ...each, decision: "approved" })),
      }),
    ],
  } satisfies Partial<ReviewSummary>;

  it("opens the publication from the bar when Publish review… is the primary, enabled", async () => {
    const { user } = screenOf(ready);

    screen.getByRole("region", { name: "Request" }).focus();
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(
      await screen.findByRole("dialog", { name: "Publish the review of web#31" }),
    ).toBeInTheDocument();
    expect(useAppStore.getState().reviewDialog).toEqual({ reviewId: "review-1", kind: "publish" });
  });

  it("opens the publication from the card of findings", async () => {
    const { user } = screenOf(ready);
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(
      await screen.findByRole("dialog", { name: "Publish the review of web#31" }),
    ).toBeInTheDocument();
  });

  it("leaves it alone while the publication waits for decisions", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(useAppStore.getState().reviewDialog).toBeNull();
  });

  it("leaves it to the composer, which sends with Enter", async () => {
    const { user } = screenOf(ready);
    await screen.findByRole("group", { name: "Findings of pass 1" });

    screen.getByRole("textbox", { name: "Reply to the reviewer" }).focus();
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(useAppStore.getState().reviewDialog).toBeNull();
  });

  it("opens the publication again from the bar after a publication failed", async () => {
    const { user } = screenOf({
      ...ready,
      status: "publish_failed",
      publishError: "Couldn't publish to GitHub: 422",
      situations: [makeSituation({ ...DECIDE, kind: "publish_failed", group: "error" })],
    });

    screen.getByRole("region", { name: "Request" }).focus();
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(
      await screen.findByRole("dialog", { name: "Publish the review of web#31" }),
    ).toBeInTheDocument();
  });

  it("does nothing in the apply mode, where Apply approved has no dialog", async () => {
    const { user } = screenOf({
      ...ready,
      mode: "apply",
      situations: [makeSituation({ ...DECIDE, form: "apply" })],
      canApply: true,
    });
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => expect(useAppStore.getState().reviewDialog).toBeNull());
  });
});

describe("ReviewView, the keys of a finding on the screen", () => {
  it("decides with A and D and takes the focus to the next finding to decide", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("a");

    expect(api.decideFinding).toHaveBeenCalledWith("review-1", 1, 1, "approved");
    expect(finding(3)).toHaveFocus();

    await user.keyboard("d");

    expect(api.decideFinding).toHaveBeenLastCalledWith("review-1", 1, 3, "discarded");
  });

  it("takes a decision back with the same key and stays where it is", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(2).focus();
    await user.keyboard("a");

    expect(api.decideFinding).toHaveBeenCalledWith("review-1", 1, 2, "");
    expect(finding(2)).toHaveFocus();
  });

  it("ignores the repeat of a key held down", async () => {
    screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    fireEvent.keyDown(finding(1), { key: "a", repeat: true });

    expect(api.decideFinding).not.toHaveBeenCalled();
    expect(finding(1)).toHaveFocus();
  });

  it("enters the card with ↓ from the report on the finding it holds, which A then decides", async () => {
    const marker = makeEntry("marker");
    vi.mocked(api.getTranscript).mockResolvedValueOnce(
      makeTranscript({
        taskId: "review-1",
        stage: "review",
        entries: [
          marker.marker === null
            ? marker
            : { ...marker, marker: { ...marker.marker, type: "pr_review_written", pass: 1 } },
          makeEntry("assistant"),
        ],
      }),
    );
    const { user } = screenOf();
    const card = await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toHaveTextContent("Review 1 written");
    expect(card.contains(document.activeElement)).toBe(false);

    await user.keyboard("{ArrowDown}");
    expect(finding(1)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(finding(2)).toHaveFocus();
    await user.keyboard("{ArrowUp}a");

    expect(api.decideFinding).toHaveBeenCalledWith("review-1", 1, 1, "approved");
    expect(finding(3)).toHaveFocus();
  });

  it("is one stop of Tab, the finding, never the card around it", async () => {
    const { user } = screenOf();
    const card = await screen.findByRole("group", { name: "Findings of pass 1" });

    expect(card).toHaveAttribute("tabindex", "-1");
    finding(1).focus();
    expect(card).toHaveAttribute("tabindex", "-1");

    await user.tab({ shift: true });
    expect(card.contains(document.activeElement)).toBe(false);
    await user.tab();
    expect(finding(1)).toHaveFocus();
  });

  it("edits with E, and gives the focus back to the finding with Esc and with Done", async () => {
    const { user } = screenOf();
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("e");
    expect(screen.getByRole("textbox", { name: "Text of finding 1" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Text of finding 1" })).not.toBeInTheDocument();
    expect(finding(1)).toHaveFocus();

    await user.keyboard("e");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(finding(1)).toHaveFocus();
  });

  it("opens the line on GitHub with O and in the editor with Ctrl+E, not the worktree", async () => {
    const { user } = renderWithStore(<WithShortcuts />, {
      state: makeState({
        reviews: [
          makeReviewSummary({
            status: "awaiting_decision",
            sessionStatus: "waiting",
            turnRunning: false,
            passes: [makeReviewPass({ findings: FINDINGS })],
            situations: [DECIDE],
          }),
        ],
      }),
      ui: { location: { kind: "review", id: "review-1" } },
    });
    await screen.findByRole("group", { name: "Findings of pass 1" });

    finding(1).focus();
    await user.keyboard("o");
    await user.keyboard("{Control>}e{/Control}");

    expect(api.openExternal).toHaveBeenCalledWith(FINDINGS[0]?.lineUrl);
    expect(api.openFindingInEditor).toHaveBeenCalledWith("review-1", 1, 1);
    expect(api.openReviewInEditor).not.toHaveBeenCalled();
  });
});

// WithShortcuts is the review screen with the shortcuts of the app around it.
function WithShortcuts() {
  useGlobalShortcuts();
  return <ReviewView reviewId="review-1" />;
}

describe("ReviewView, the keys of its dialogs", () => {
  it("opens the publication on Cancel, chooses with the digits and the arrows, and publishes with Ctrl+Enter only once chosen", async () => {
    const { user } = screenOf({
      status: "ready_to_publish",
      canPublish: true,
      situations: [PUBLISH],
      passes: [
        makeReviewPass({
          findings: FINDINGS.map((each) => makeReviewFinding({ ...each, decision: "approved" })),
        }),
      ],
    });
    screen.getByRole("region", { name: "Request" }).focus();
    await user.keyboard("{Control>}{Enter}{/Control}");
    const dialog = await screen.findByRole("dialog", { name: "Publish the review of web#31" });
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(api.publishReview).not.toHaveBeenCalled();

    await user.keyboard("1");
    const verdict = (name: RegExp) => within(dialog).getByRole("radio", { name });
    expect(verdict(/Request changes/)).toHaveAttribute("aria-checked", "true");
    verdict(/Request changes/).focus();
    await user.keyboard("{ArrowDown}");
    expect(verdict(/Approve/)).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(verdict(/Request changes/)).toHaveFocus();
    await user.keyboard("3");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.publishReview).toHaveBeenCalledWith("review-1", "comment", true);
  });

  it("opens Review again… on Cancel when a pass never published would lose its decisions", async () => {
    const { user } = screenOf({ canReviewAgain: true });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Review again…" }));

    const dialog = await screen.findByRole("dialog", { name: "Review web#31 again" });
    expect(dialog).toHaveTextContent("The decisions and edits of review 1 will be discarded.");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
  });

  it("opens Review again… on Review again when nothing would be lost", async () => {
    const { user } = screenOf({
      status: "new_commits",
      canReviewAgain: true,
      newCommits: 3,
      passes: [makeReviewPass({ published: true })],
      situations: [makeSituation({ ...DECIDE, kind: "new_commits" })],
    });
    await user.click(screen.getByRole("button", { name: "Review again…" }));

    const dialog = await screen.findByRole("dialog", { name: "Review web#31 again" });
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /^Review again/ })).toHaveFocus(),
    );
  });
});
