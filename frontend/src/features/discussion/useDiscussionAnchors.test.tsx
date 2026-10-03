import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Conversation } from "@/features/chat/Conversation";
import { discussionInputOf } from "@/features/discussion/discussion-request";
import { useDiscussionAnchors } from "@/features/discussion/useDiscussionAnchors";
import type { DiscussionSummary, Entry } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeDraft, makeEntry } from "@/test/wails-mock";

function written(round: number): Entry {
  const entry = makeEntry("marker");
  return entry.marker === null
    ? entry
    : { ...entry, marker: { ...entry.marker, type: "drafts_written", round, count: 1 } };
}

function Harness({
  discussion,
  card,
}: {
  discussion: DiscussionSummary;
  card?: string | undefined;
}) {
  const { after, before } = useDiscussionAnchors(
    discussion,
    card === undefined ? null : <p>{card}</p>,
  );
  return (
    <Conversation
      stage="discussion"
      taskId={discussion.id}
      session={discussion}
      discussion={discussionInputOf(discussion)}
      after={after}
      before={before}
    />
  );
}

function show(entries: Entry[], drafts: DiscussionSummary["drafts"], card?: string) {
  const discussion = makeDiscussion({ drafts });
  return renderWithStore(<Harness discussion={discussion} card={card} />, {
    ui: {
      transcripts: {
        "discussion-1|discussion": {
          status: "ready",
          error: "",
          entries,
          pending: [],
          buffered: [],
        },
      },
    },
  });
}

describe("useDiscussionAnchors", () => {
  it("folds a round without a marker before the Drafts written of the next, with no time", () => {
    const next = written(2);
    show(
      [next],
      [makeDraft({ id: "d1", round: 1 }), makeDraft({ id: "d2", position: 2, round: 2 })],
    );

    const feed = screen.getByRole("feed");
    const names = within(feed)
      .getAllByRole("article")
      .map((article) => article.getAttribute("aria-label") ?? "");
    expect(names[0]).toBe("Round 1 · 1 draft · nothing published");
    expect(names[1]).toMatch(/^Drafts written · round 2/);
  });

  it("draws the card after the latest marker of the current round", () => {
    show([written(1), makeEntry("assistant")], [makeDraft({ round: 1 })], "The card");

    const feed = screen.getByRole("feed");
    const card = within(feed).getByText("The card");
    const marker = within(feed).getByRole("article", { name: /^Drafts written/ });
    expect(marker.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws no card without one", () => {
    show([written(1)], [makeDraft({ round: 1 })]);

    expect(screen.queryByText("The card")).not.toBeInTheDocument();
  });
});
