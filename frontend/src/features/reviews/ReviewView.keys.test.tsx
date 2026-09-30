import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewView } from "@/features/reviews/ReviewView";
import type { ReviewSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeReviewFinding,
  makeReviewPass,
  makeReviewSummary,
  makeSituation,
  makeState,
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
