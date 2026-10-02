import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscussionBar } from "@/features/discussion/DiscussionBar";
import type { DiscussionSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makeDiscussion,
  makeDraft,
  makeDraftRef,
  makeSituation,
  makeState,
} from "@/test/wails-mock";

function bar(overrides: Partial<DiscussionSummary> = {}) {
  const discussion = makeDiscussion(overrides);
  return renderWithStore(<DiscussionBar discussion={discussion} />, {
    state: makeState({ discussions: [discussion] }),
  });
}

describe("DiscussionBar", () => {
  it("says where the discussion stands", () => {
    bar({ status: "deciding" });

    expect(screen.getByRole("status")).toHaveTextContent("Decide drafts");
  });

  it("warns that the drafts could not be read", () => {
    bar({ unreadableDrafts: "Draft export-invoices has no title." });

    expect(screen.getByText("Draft export-invoices has no title.")).toHaveAttribute(
      "title",
      "Draft export-invoices has no title.",
    );
  });

  it.each([
    [
      "epic_cant_publish",
      "waiting",
      "Epic can't publish",
      [
        makeDraft({
          kind: "epic",
          decision: "approved",
          hold: { reason: "epic_short", title: "", left: 0, approved: 1, cards: 3 },
        }),
      ],
      "1 of 3 cards approved · approve one more, or discard the epic",
    ],
    [
      "epic_discarded",
      "waiting",
      "Epic discarded",
      [
        makeDraft({ id: "epic-1", kind: "epic", decision: "discarded" }),
        makeDraft({
          id: "card-1",
          decision: "approved",
          epic: makeDraftRef({ draft: "epic-1" }),
          hold: { reason: "epic_discarded", title: "", left: 0, approved: 0, cards: 0 },
        }),
      ],
      "1 approved card of it won't publish · approve the epic again, or discard it",
    ],
    [
      "ready_to_archive",
      "closing",
      "Ready to archive",
      [makeDraft({ published: true })],
      "1 published · or ask the agent for more cards below",
    ],
  ])("tells %s in its middle, beside the status", (status, group, label, drafts, detail) => {
    bar({
      status,
      drafts,
      situations: [
        makeSituation({
          taskId: "discussion-1",
          kind: status,
          group,
          place: { kind: "discussion", stage: "", step: 0 },
        }),
      ],
    });

    expect(screen.getByRole("status")).toHaveTextContent(label);
    expect(screen.getByText(detail)).toHaveAttribute("title", detail);
  });

  it("keeps saying Publish failed while the independent drafts publish", () => {
    bar({
      status: "publishing",
      situations: [
        makeSituation({
          taskId: "discussion-1",
          kind: "publish_failed",
          group: "error",
          place: { kind: "discussion", stage: "", step: 0 },
        }),
      ],
    });

    expect(screen.getByRole("status")).toHaveTextContent("Publish failed");
    expect(screen.getByText("Publishing…")).toBeInTheDocument();
  });

  it("says it is publishing while it publishes", () => {
    bar({ status: "publishing" });

    expect(screen.getByText("Publishing…")).toBeInTheDocument();
  });
});
