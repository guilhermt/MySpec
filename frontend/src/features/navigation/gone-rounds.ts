import type { ArchivedDiscussion } from "@/lib/wails";
import { asDraftOutcome } from "@/lib/wails";
import { clockTime, shortTime } from "@/lib/when";

/** DELETED_DISCUSSION_TEXT is the text of the page of a discussion that was deleted. */
export const DELETED_DISCUSSION_TEXT =
  "The conversation, the document and the drafts are gone. What was published on GitHub stays.";

/** goneDiscussionText is the text of the page of a discussion that was archived. */
export function goneDiscussionText(archived: ArchivedDiscussion, now: number): string {
  const time = clockTime(archived.archivedAt, now);
  return `The conversation ended${time === "" ? "" : ` at ${time}`}. The document, the drafts and what was published are in History; a task started from one of these cards gets the document in its context.`;
}

/**
 * goneRoundLines are the rounds of an archived discussion, one line each, "Round 1 · 4 created, 1
 * updated" or "Round 2 · nothing published", with the time of the last publication of the round.
 */
export function goneRoundLines(
  archived: ArchivedDiscussion,
  now: number,
): { text: string; time: string }[] {
  const drafts = archived.drafts ?? [];
  const rounds = [...new Set(drafts.map((draft) => draft.round))].sort((a, b) => a - b);
  return rounds.map((round) => {
    const published = drafts.filter((draft) => draft.round === round && draft.published);
    const created = published.filter((draft) => asDraftOutcome(draft.outcome) === "created").length;
    const updated = published.filter((draft) => asDraftOutcome(draft.outcome) === "updated").length;
    const outcome = [
      created > 0 ? `${created} created` : "",
      updated > 0 ? `${updated} updated` : "",
    ]
      .filter((part) => part !== "")
      .join(", ");
    const last = published
      .map((draft) => draft.publishedAt)
      .filter((at) => !Number.isNaN(Date.parse(at)))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    return {
      text: `Round ${round} · ${outcome === "" ? "nothing published" : outcome}`,
      time: last === undefined ? "" : shortTime(last, now),
    };
  });
}
