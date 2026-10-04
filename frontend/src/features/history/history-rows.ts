import type { HistoryRowView } from "@/components/system/ListRow";
import { pluralize } from "@/features/boards/board-dialog";
import { recordedPasses, stepsOf } from "@/features/history/archived";
import { baseNotUpdated } from "@/features/history/close-result";
import { archivedOn, type HistoryEntry } from "@/features/history/history-list";
import { boardOfRepository } from "@/lib/boards";
import { sharedNames, shortName } from "@/lib/repositories";
import { isOneShot } from "@/lib/task-modes";
import type { ArchivedDiscussion, ArchivedReview, ArchivedTask, State } from "@/lib/wails";
import { clockOf } from "@/lib/when";

// shortRepository is the repository as a row writes it: the name, or owner/name when the owner is
// not the one of the board of the item or another repository has the same name, so two repositories
// called api are not mistaken.
function shortRepository(app: State, repositoryId: string, fullName: string): string {
  const board = boardOfRepository(app, repositoryId);
  const foreign =
    board !== null && !fullName.toLowerCase().startsWith(`${board.owner.toLowerCase()}/`);
  const shared = sharedNames(app).has(shortName(fullName).toLowerCase());
  return foreign || shared ? fullName : shortName(fullName);
}

/** RowText is what a row says of an item, before the time and the name that go with it. */
interface RowText {
  kind: string;
  glyph: HistoryRowView["glyph"];
  name: string;
  where: string;
  whereTooltip: string;
  result: string;
  resultStrong: string;
  strongFirst: boolean;
}

function taskText(task: ArchivedTask, app: State): RowText {
  const number = task.card === null ? "" : `#${task.card.number}`;
  const oneShot = isOneShot(task);
  const size = oneShot ? "One-Shot" : pluralize(stepsOf(task).length, "step");
  const base = task.close === null ? "" : baseNotUpdated(task.close);
  return {
    kind: oneShot ? "One-Shot task" : "Task",
    glyph: oneShot ? "oneShot" : "task",
    name: task.name,
    where: `${shortRepository(app, task.repositoryId, task.repository)}${number}`,
    whereTooltip: `${task.repository}${number}`,
    result: task.pr === null ? size : `PR #${task.pr.number} · ${size}`,
    resultStrong: base === "" ? "" : ` · ${base}`,
    strongFirst: false,
  };
}

function reviewText(review: ArchivedReview, app: State): RowText {
  const passes = recordedPasses(review).length;
  const counted = passes === 0 ? "no passes" : pluralize(passes, "pass", "passes");
  const closed = review.outcome === "closed";
  return {
    kind: "Review",
    glyph: "review",
    name: review.title,
    where: `${shortRepository(app, review.repositoryId, review.repository)}#${review.number}`,
    whereTooltip: `${review.repository}#${review.number}`,
    result: closed ? ` · ${counted}` : `Merged · ${counted}`,
    resultStrong: closed ? "Closed" : "",
    strongFirst: closed,
  };
}

function discussionText(discussion: ArchivedDiscussion): RowText {
  const board = discussion.board === "" ? "No board" : discussion.board;
  return {
    kind: "Discussion",
    glyph: "discussion",
    name: discussion.title,
    where: board,
    whereTooltip: board,
    result:
      discussion.publishedCount === 0
        ? "Nothing published"
        : `${pluralize(discussion.publishedCount, "card")} published`,
    resultStrong: "",
    strongFirst: false,
  };
}

/**
 * historyRow is the row of an archived item: its kind, name, where it came from, what became of it
 * and the hour it was archived, with the accessible name that says all of it and the day.
 */
export function historyRow(
  entry: HistoryEntry,
  app: State,
  now: number,
  fresh: boolean,
): HistoryRowView {
  const text =
    entry.kind === "task"
      ? taskText(entry.task, app)
      : entry.kind === "review"
        ? reviewText(entry.review, app)
        : discussionText(entry.discussion);
  const time = clockOf(entry.archivedAt);
  const whole = text.strongFirst
    ? `${text.resultStrong}${text.result}`
    : `${text.result}${text.resultStrong}`;
  const archived = `archived ${archivedOn(entry.archivedAt, now)} at ${time}`;
  return {
    key: entry.id,
    glyph: text.glyph,
    name: text.name,
    where: text.where,
    whereTooltip: text.whereTooltip,
    result: text.result,
    resultStrong: text.resultStrong,
    strongFirst: text.strongFirst,
    time,
    label: `${text.kind} ${text.name}, ${text.where}, ${whole}, ${archived}${fresh ? ", just archived" : ""}`,
  };
}
