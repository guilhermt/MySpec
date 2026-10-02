import type { MarkerBody, MarkerView } from "@/features/chat/markers";
import { holdStands } from "@/features/discussion/discussion-status";
import { cardEntries, isBlocked } from "@/features/discussion/drafts-card";
import { contextCharacters } from "@/features/discussion/new-discussion";
import { draftTitle, publishedOutcome } from "@/lib/drafts";
import { shortName, shortRef } from "@/lib/repositories";
import { counted, listed } from "@/lib/situations";
import type {
  DiscussionCard,
  Draft,
  DraftBefore,
  Entry,
  MarkerEntry,
  UserEntry,
} from "@/lib/wails";
import { asDraftKind, asDraftOutcome, asHoldReason, asMarkerType } from "@/lib/wails";
import { shortTime } from "@/lib/when";

/** DiscussionInput is what the conversation of a discussion knows of it: the active one or the archived one. */
export interface DiscussionInput {
  id: string;
  drafts: readonly Draft[];
  text: string;
  cards: readonly DiscussionCard[];
  documentRevision: number;
}

/** RoundFolds is where the rounds before the current one fold in the conversation (material §4.2, A rodada dobra). */
export interface RoundFolds {
  /** current is the current round; 0 without drafts. */
  current: number;
  /** asRound are the markers that read as "Round N": the publication of the round, or its Drafts written without one. */
  asRound: ReadonlyMap<string, number>;
  /** hidden are the markers of a folded round that leave: Drafts written, Drafts revised. */
  hidden: ReadonlySet<string>;
  /** before are the rounds without a marker, folded before the Drafts written of the next round, by the id of that marker. */
  before: ReadonlyMap<string, number>;
  /** cardAfter is the id of the latest Drafts written or Drafts revised of the current round; "end" without one. */
  cardAfter: string;
  /** revisions is how many Drafts revised each round has. */
  revisions: ReadonlyMap<number, number>;
  /** latestDocument is the id of the latest discussion_document marker; "" without one. */
  latestDocument: string;
  /** epics is the number of epics the start marker recorded; null for a discussion that recorded none. */
  epics: number | null;
}

/** DraftRowView is one draft in the list a marker opens. */
export interface DraftRowView {
  /** key tells the row apart in its list: the id of the draft, or for a row of a revision, which has no id, its place and title. */
  key: string;
  glyph: "check" | "hold" | "error" | "blocked" | "spinner" | "pencil" | null;
  /** prefix is "Epic · ", "Update gateway#461 · " or "". */
  prefix: string;
  title: string;
  /** status is the right side: "Created billing#479", "Publishing…", "Next", "Waits for the epic", "Discarded · not published", "Not decided", the reason of a failure… */
  status: string;
  tone: "normal" | "quiet" | "error";
  link: { label: string; url: string } | null;
}

/** END is the key of what comes before the card of the drafts, when no marker of the next round is there. */
const END = "end";

/** Found is a marker of the conversation with the id of its entry. */
interface Found {
  id: string;
  marker: MarkerEntry;
}

// markersOf are the markers of the conversation of a type, in order.
function markersOf(entries: readonly Entry[], ...types: string[]): Found[] {
  return entries.flatMap((entry) =>
    entry.marker !== null && types.includes(asMarkerType(entry.marker.type))
      ? [{ id: entry.id, marker: entry.marker }]
      : [],
  );
}

/**
 * roundFolds is where the rounds before the current one fold: the publication of a round, or its
 * Drafts written, becomes the line Round N; the other markers of the round, and its card, leave. A
 * round without either, of a discussion from before the marker, folds before the Drafts written of
 * the next round.
 */
export function roundFolds(entries: readonly Entry[], drafts: readonly Draft[]): RoundFolds {
  const current = Math.max(0, ...drafts.map((draft) => draft.round));
  const written = markersOf(entries, "drafts_written");
  const revised = markersOf(entries, "drafts_revised");
  const published = markersOf(entries, "drafts_published");
  const asRound = new Map<string, number>();
  const hidden = new Set<string>();
  const before = new Map<string, number>();
  for (let round = 1; round < current; round += 1) {
    const ofRound = (found: Found[]) => found.filter(({ marker }) => marker.round === round);
    const publication = ofRound(published)[0];
    const writing = ofRound(written);
    const revising = ofRound(revised);
    if (publication !== undefined) {
      asRound.set(publication.id, round);
      for (const { id } of [...writing, ...revising]) {
        hidden.add(id);
      }
    } else if (writing[0] !== undefined) {
      asRound.set(writing[0].id, round);
      for (const { id } of writing.slice(1)) {
        hidden.add(id);
      }
      for (const { id } of revising) {
        hidden.add(id);
      }
    } else if (drafts.some((draft) => draft.round === round)) {
      const next = written.find(({ marker }) => marker.round === round + 1);
      before.set(next?.id ?? END, round);
    }
  }
  const revisions = new Map<number, number>();
  for (const { marker } of revised) {
    revisions.set(marker.round, (revisions.get(marker.round) ?? 0) + 1);
  }
  const latestOfCard = [...written, ...revised]
    .filter(({ marker }) => marker.round === current)
    .map(({ id }) => id);
  const latestCard = entries
    .map((entry) => entry.id)
    .filter((id) => latestOfCard.includes(id))
    .at(-1);
  const started = markersOf(entries, "discussion_started")[0]?.marker;
  const recorded = (started?.epics ?? []).length;
  const epics = started === undefined || (started.model === "" && recorded === 0) ? null : recorded;
  return {
    current,
    asRound,
    hidden,
    before,
    cardAfter: latestCard ?? END,
    revisions,
    latestDocument: markersOf(entries, "discussion_document").at(-1)?.id ?? "",
    epics,
  };
}

const NONE: MarkerBody = { kind: "none" };

function line(
  icon: MarkerView["icon"],
  text: string,
  complement = "",
  body: MarkerBody = NONE,
): MarkerView {
  return { icon, text, complement, body, timeHidden: false };
}

// MOST_LISTED is how many cards of entry the Context lists before it counts the rest.
const MOST_LISTED = 3;

// contextComplement is what the Context says it is made from: the cards, their epics, "the board and your text".
function contextComplement(cards: readonly DiscussionCard[], epics: number | null): string {
  if (cards.length === 0) {
    return "the board and your text";
  }
  const epic = epics === null || epics === 0 ? null : epics === 1 ? "epic" : `${epics} epics`;
  const numbers = cards.map((card) => `#${card.number}`);
  if (cards.length > MOST_LISTED) {
    const rest = cards.length - MOST_LISTED;
    const more = `${numbers.slice(0, MOST_LISTED).join(", ")} and ${rest} more card${rest === 1 ? "" : "s"}`;
    return epic === null ? more : `${more}, with their ${epic}`;
  }
  if (epic === null) {
    return listed(numbers);
  }
  return `${numbers.join(", ")} and ${cards.length === 1 ? "its" : "their"} ${epic}`;
}

/**
 * contextLineOf is the line Context, from the message that opened the session: the cards of entry
 * and their epic, and the size of the context; it opens that context. Without the prompt it says
 * where the context comes from and opens nothing.
 */
export function contextLineOf(
  prompt: UserEntry | null,
  discussion: DiscussionInput,
  epics: number | null,
): MarkerView {
  const from = contextComplement(discussion.cards, epics);
  if (prompt === null) {
    return line("file", "Context", from);
  }
  return line("file", "Context", `${from} · ${contextCharacters(prompt.text)}`, {
    kind: "discussionDocument",
    name: "context.md",
    text: prompt.text,
  });
}

/** documentLineOf is the line of the document written or rewritten; only the latest opens it. */
export function documentLineOf(marker: MarkerEntry, latest: boolean): MarkerView {
  return line(
    "file",
    `${marker.first ? "Written" : "Updated"} discussion.md`,
    "the understanding",
    latest ? { kind: "discussionDocument", name: "discussion.md", text: null } : NONE,
  );
}

/** writtenLineOf is the line of the drafts a round starts with: "Drafts written · round 1 · 5 drafts". */
export function writtenLineOf(marker: MarkerEntry): MarkerView {
  return line(
    "file",
    "Drafts written",
    `round ${marker.round} · ${counted(marker.count, "draft")}`,
  );
}

// beforeStatus is what a revision did to a draft of the round, on its right in the list.
function beforeStatus(before: DraftBefore): string {
  if (before.dropped) {
    return "dropped by the agent";
  }
  if (before.added) {
    return "added";
  }
  const changes = before.changes ?? [];
  if (changes.length > 0) {
    const cleared = before.approvalCleared ? " · your approval was cleared" : "";
    return `${changes.join(", ")}${cleared}`;
  }
  const outcome = asDraftOutcome(before.outcome);
  if (outcome !== "") {
    return `${outcome === "created" ? "Created" : "Updated"} ${shortRef(before.reference)}`;
  }
  return before.decision === "" ? "not changed" : `not changed · ${before.decision}`;
}

// beforePrefix is the kind of a draft before the revision, as its row opens.
function beforePrefix(before: DraftBefore): string {
  switch (asDraftKind(before.kind)) {
    case "epic":
      return "Epic · ";
    case "update":
      return before.reference === "" ? "Update · " : `Update ${shortRef(before.reference)} · `;
    case "new":
      return "";
  }
}

function beforeRow(before: DraftBefore, index: number): DraftRowView {
  const changed = (before.changes ?? []).length > 0 || before.added;
  return {
    key: `${index}·${before.title}`,
    glyph: changed ? "pencil" : null,
    prefix: beforePrefix(before),
    title: before.title,
    status: beforeStatus(before),
    tone: changed ? "normal" : "quiet",
    link: null,
  };
}

/** revisedLineOf is the line of a revision of the drafts, and the list of the round as it was before it. */
export function revisedLineOf(marker: MarkerEntry): MarkerView {
  const all = marker.before ?? [];
  const parts = [
    marker.changed > 0 ? `${marker.changed} changed` : "",
    marker.added > 0 ? `${marker.added} added` : "",
    marker.dropped > 0 ? `${marker.dropped} dropped` : "",
  ].filter((part) => part !== "");
  const rows = [...all.filter((one) => !one.added), ...all.filter((one) => one.added)].map(
    beforeRow,
  );
  return line(
    "file",
    "Drafts revised",
    [`round ${marker.round}`, parts.join(", ")].filter((part) => part !== "").join(" · "),
    rows.length === 0 ? NONE : { kind: "drafts", rows },
  );
}

/** unreadableLineOf is the line of the drafts file that can't be read, with the reason. */
export function unreadableLineOf(marker: MarkerEntry): MarkerView {
  return line("problem", "drafts.md can't be read", marker.reason);
}

// holdWord is what an approved draft that waits says on the right of its row.
function holdWord(draft: Draft): string {
  const { hold } = draft;
  switch (asHoldReason(hold.reason)) {
    case "epic":
      return "Waits for the epic";
    case "draft":
      return `Waits for ${hold.title}`;
    case "cards":
      return `Waits for ${counted(hold.left, "more card")} of the epic`;
    case "epic_short":
      return "The epic needs two approved cards";
    case "epic_discarded":
      return "The epic is discarded · not published";
    case "":
      return "Next";
  }
}

// rowPrefix is the kind of a draft as its row opens: "Epic · ", "Update gateway#461 · ".
function rowPrefix(draft: Draft): string {
  switch (asDraftKind(draft.kind)) {
    case "epic":
      return "Epic · ";
    case "update":
      return draft.card === null
        ? "Update · "
        : `Update ${shortName(draft.card.repository)}#${draft.card.number} · `;
    case "new":
      return "";
  }
}

// rowOf is a draft in the list of a round, by what became of it.
function rowOf(draft: Draft): DraftRowView {
  const base = {
    key: draft.id,
    glyph: null,
    prefix: rowPrefix(draft),
    title: draftTitle(draft),
    link: null,
  };
  if (draft.published) {
    const label = `${shortName(draft.repository)}#${draft.number}`;
    const did = asDraftOutcome(draft.outcome) === "updated" ? "Updated" : "Created";
    return {
      ...base,
      glyph: "check",
      status: `${did} ${label}`,
      tone: "normal",
      link: { label, url: draft.url },
    };
  }
  if (draft.publishing) {
    return { ...base, glyph: "spinner", status: "Publishing…", tone: "normal" };
  }
  if (draft.publishError !== "") {
    return { ...base, glyph: "error", status: draft.publishError, tone: "error" };
  }
  if (draft.decision === "discarded") {
    return { ...base, status: "Discarded · not published", tone: "quiet" };
  }
  if (draft.decision === "approved") {
    const waits = asHoldReason(draft.hold.reason) !== "";
    return {
      ...base,
      glyph: waits ? "hold" : null,
      status: holdWord(draft),
      tone: waits && holdStands(draft) ? "normal" : "quiet",
    };
  }
  if (isBlocked(draft)) {
    return {
      ...base,
      glyph: "blocked",
      status: "Can't publish · the repository left the board",
      tone: "quiet",
    };
  }
  return { ...base, status: "Not decided", tone: "quiet" };
}

// rowsOf are the drafts of a round in the order of the card.
function rowsOf(round: number, drafts: readonly Draft[]): DraftRowView[] {
  return cardEntries({ drafts: [...drafts], round }).map((entry) => rowOf(entry.draft));
}

// span is the time of a publication, from the first draft to the last: "14:29 – 15:12"; "" without one.
function span(mine: readonly Draft[], now: number): string {
  const times = mine
    .filter((draft) => draft.published && !Number.isNaN(Date.parse(draft.publishedAt)))
    .map((draft) => draft.publishedAt)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const first = times[0];
  const last = times.at(-1);
  if (first === undefined || last === undefined) {
    return "";
  }
  const from = shortTime(first, now);
  const to = shortTime(last, now);
  return from === to ? from : `${from} – ${to}`;
}

/** publishedLineOf is the line of the publication of a round, which tells its state from the drafts of the round and opens the list. */
export function publishedLineOf(round: number, drafts: readonly Draft[], now: number): MarkerView {
  const mine = drafts.filter((draft) => draft.round === round);
  const published = mine.filter((draft) => draft.published).length;
  const failed = mine.filter((draft) => draft.publishError !== "");
  const rows: MarkerBody = { kind: "drafts", rows: rowsOf(round, drafts) };
  const timeText = span(mine, now);
  const view = (text: string, complement: string, tone?: "error"): MarkerView => ({
    ...line(tone === "error" ? "problem" : "pullRequest", text, complement, rows),
    ...(timeText === "" ? {} : { timeText }),
    ...(tone === undefined ? {} : { tone }),
  });
  const first = failed[0];
  if (first !== undefined) {
    const more = failed.length > 1 ? ` and ${failed.length - 1} more` : "";
    return view(
      "Publication stopped",
      [
        `round ${round}`,
        published > 0 ? `${published} published` : "",
        `${draftTitle(first)}${more} failed`,
      ]
        .filter((part) => part !== "")
        .join(" · "),
      "error",
    );
  }
  const open = mine.some((draft) => !draft.published && draft.decision !== "discarded");
  return view(
    "Published",
    `round ${round} · ${open ? `${published} so far` : publishedOutcome(mine)}`,
  );
}

// revised says how many times a round was revised: "revised once", "revised twice", "revised 3 times".
function revised(revisions: number): string {
  if (revisions === 1) {
    return "revised once";
  }
  return revisions === 2 ? "revised twice" : `revised ${revisions} times`;
}

/** roundLineOf is the line a round before the current one folds into, and the list of its drafts with their links. */
export function roundLineOf(
  round: number,
  drafts: readonly Draft[],
  revisions: number,
): MarkerView {
  const mine = drafts.filter((draft) => draft.round === round);
  const count = [counted(mine.length, "draft"), revisions > 0 ? revised(revisions) : ""]
    .filter((part) => part !== "")
    .join(", ");
  return line(
    "pullRequest",
    `Round ${round}`,
    `${count} · ${publishedOutcome(mine) || "nothing published"}`,
    {
      kind: "drafts",
      rows: rowsOf(round, drafts),
    },
  );
}
