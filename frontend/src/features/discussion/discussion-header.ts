import type { MenuRowItem } from "@/components/MenuRow";
import type { PillView, StepperGlyph } from "@/components/system/Pill";
import type { StepperStepView } from "@/components/system/Stepper";
import { groupable } from "@/features/discussion/drafts-card";
import { modelLabel } from "@/lib/models";
import { counted, lowerFirst, situationPillState } from "@/lib/situations";
import type { Board, DiscussionSummary, Draft, Repository, SituationGroup } from "@/lib/wails";
import { asDraftOutcome, asSessionStatus, asSituationGroup } from "@/lib/wails";
import { clockTime, shortTime, startedTime } from "@/lib/when";

/** DiscussionStepperModel is the pill of a discussion in a stepper of one stage, its name and its tooltip. */
export interface DiscussionStepperModel {
  steps: StepperStepView[];
  pill: PillView;
  /** label is "Progress · Round 1 · waiting for you: decide drafts". */
  label: string;
  /** tooltip is the label, the whole state. */
  tooltip: string[];
}

const SITUATION_GLYPHS: Record<SituationGroup, StepperGlyph> = {
  error: "error",
  waiting: "wait",
  closing: "close",
};

/** Moment is the glyph, the word and the state of the pill. */
type Moment = Pick<PillView, "glyph" | "word" | "shimmer" | "state">;

function busy(word: string, state: string): Moment {
  return { glyph: "work", word, shimmer: false, state };
}

// momentOf is the pill of a discussion neither paused nor waiting on the user.
function momentOf(discussion: DiscussionSummary): Moment {
  if (asSessionStatus(discussion.sessionStatus) === "working") {
    return busy("working", "Discussion agent working");
  }
  if (discussion.publishing) {
    return busy("publishing", "publishing");
  }
  return { glyph: null, word: "", shimmer: false, state: "idle" };
}

function pillOf(discussion: DiscussionSummary, now: number): PillView {
  const place = {
    name: discussion.round === 0 ? "Discussing" : "Round",
    position: discussion.round === 0 ? "" : String(discussion.round),
    qualifier: "",
    keepsQualifier: false,
  };
  if (asSessionStatus(discussion.sessionStatus) === "paused") {
    return {
      ...place,
      glyph: "paused",
      word: "paused",
      shimmer: false,
      paused: true,
      state:
        discussion.pausedAt === ""
          ? "paused"
          : `paused since ${clockTime(discussion.pausedAt, now)}`,
    };
  }
  const situations = discussion.situations ?? [];
  const [situation] = situations;
  if (situation !== undefined) {
    return {
      ...place,
      glyph: SITUATION_GLYPHS[asSituationGroup(situation.group)],
      word: "",
      shimmer: false,
      paused: false,
      state: situationPillState(situation, situations.length),
    };
  }
  return { ...place, ...momentOf(discussion), paused: false };
}

/**
 * discussionStepper is the pill of a discussion alone in a stepper of one stage: Discussing before
 * the first drafts, and Round with its position after; with a situation the glyph of its gravity
 * and no word, since the bar says it. The accessible name and the tooltip hold the whole state.
 */
export function discussionStepper(
  discussion: DiscussionSummary,
  now: number,
): DiscussionStepperModel {
  const pill = pillOf(discussion, now);
  const name = pill.position === "" ? pill.name : `${pill.name} ${pill.position}`;
  const label = `Progress · ${name} · ${pill.state}`;
  return {
    steps: [{ id: "round", name, state: "current" }],
    pill,
    label,
    tooltip: [label],
  };
}

/** DiscussionMenuAction is what an item of the ⋯ of a discussion does. */
export type DiscussionMenuAction = "openBoard" | "group" | "archive" | "delete";

/** DiscussionMenuItem is one item of the ⋯ of a discussion, as the ⋯ of a review draws it. */
export interface DiscussionMenuItem extends MenuRowItem {
  /** id is a stable key: "discussion.archive". */
  id: string;
  action: DiscussionMenuAction;
}

/** DiscussionMenuGroup is a group of the ⋯ of a discussion; a null label is the group after the separator. */
export interface DiscussionMenuGroup {
  label: string | null;
  items: DiscussionMenuItem[];
}

// archiveRefusal is ArchiveHint as the ⋯ writes it after "· ": in lower case, without the full stop.
function archiveRefusal(discussion: DiscussionSummary): string {
  const hint = lowerFirst(discussion.archiveHint).replace(/\.$/, "");
  return hint === "" ? "it can't be archived now" : hint;
}

/**
 * discussionMenu is the ⋯ of a discussion: legend Discussion; the board, grouping, archiving; then
 * Delete discussion…, red. withGroup says the item that groups the drafts is there.
 */
export function discussionMenu(
  discussion: DiscussionSummary,
  boardTitle: string | null,
  withGroup: boolean,
): DiscussionMenuGroup[] {
  const running = discussion.publishing ? "a publication is running" : null;
  const items: DiscussionMenuItem[] = [];
  if (boardTitle !== null) {
    items.push({
      id: "board.open",
      label: `Open ${boardTitle}`,
      action: "openBoard",
      icon: "board",
    });
  }
  if (withGroup) {
    const refusal =
      groupable(discussion).length < 2 ? "needs two loose drafts not published" : running;
    items.push({
      id: "discussion.group",
      label: "Group drafts into an epic…",
      action: "group",
      icon: "epic",
      ...(refusal === null ? {} : { disabledReason: refusal }),
    });
  }
  items.push({
    id: "discussion.archive",
    label: "Archive…",
    action: "archive",
    icon: "archive",
    ...(discussion.canArchive ? {} : { disabledReason: archiveRefusal(discussion) }),
  });
  return [
    { label: "Discussion", items },
    {
      label: null,
      items: [
        {
          id: "discussion.delete",
          label: "Delete discussion…",
          action: "delete",
          icon: "trash",
          destructive: true,
          ...(running === null ? {} : { disabledReason: running }),
        },
      ],
    },
  ];
}

/** discussionPauseRefusal is why Pause is dashed: the session stopped on an error. */
export function discussionPauseRefusal(discussion: DiscussionSummary): string | null {
  return discussion.lastError === ""
    ? null
    : "Nothing is running to pause: the session stopped with an error. Retry it.";
}

/** DetailsCard is a card of entry of the discussion, as Details lists it. */
export interface DetailsCard {
  number: number;
  title: string;
  /** inReading says the last reading of the board has the card, so the link opens it on the board; otherwise it opens the issue. */
  inReading: boolean;
  url: string;
}

/** DetailsRepository is a repository of the board the conversation can't read. */
export interface DetailsRepository {
  id: string;
  fullName: string;
  /** missing is a clone that is gone; otherwise there was none. */
  missing: boolean;
  cloning: boolean;
}

/** DetailsRound is a round of the drafts: "Round 1 · 5 drafts · 4 created, 1 updated" and the time of its last publication. */
export interface DetailsRound {
  text: string;
  time: string;
}

/** DetailsDocument is a document of the discussion Details opens in Documents. */
export interface DetailsDocument {
  name: "context.md" | "discussion.md";
  label: string;
  enabled: boolean;
}

/** DiscussionDetailsModel is what the Details panel of a discussion says; a fact without a value is absent. */
export interface DiscussionDetailsModel {
  discussion: {
    /** board is the title, "acme · project 7" and whether the board is still in the app to open; null without a title. */
    board: { title: string; detail: string; open: boolean } | null;
    cards: DetailsCard[];
    /** read are the repositories with a clone, by ", ". */
    read: string;
    notCloned: DetailsRepository[];
    /** model is "Opus 5.5 (1M) · high", the one of the session. */
    model: string;
    /** started is "Today 14:02". */
    started: string;
  };
  rounds: DetailsRound[];
  documents: DetailsDocument[];
}

/**
 * roundSummary is what a round of drafts says of itself: "5 drafts · 4 created, 1 updated";
 * "nothing published" without a publication; and, for the current round with something to decide,
 * how far it is, "3 drafts · 1 created · 2 of 3 decided".
 */
export function roundSummary(drafts: readonly Draft[], round: number): string {
  const current = Math.max(0, ...drafts.map((draft) => draft.round));
  const mine = drafts.filter((draft) => draft.round === round);
  const published = mine.filter((draft) => draft.published);
  const created = published.filter((draft) => asDraftOutcome(draft.outcome) === "created").length;
  const updated = published.filter((draft) => asDraftOutcome(draft.outcome) === "updated").length;
  const outcome = [created > 0 ? `${created} created` : "", updated > 0 ? `${updated} updated` : ""]
    .filter((part) => part !== "")
    .join(", ");
  const decided = mine.filter((draft) => draft.decision !== "" || draft.published).length;
  return [
    counted(mine.length, "draft"),
    outcome === "" ? "nothing published" : outcome,
    round === current && decided < mine.length ? `${decided} of ${mine.length} decided` : "",
  ]
    .filter((part) => part !== "")
    .join(" · ");
}

// lastPublished is the latest time a round published a draft, "" without one.
function lastPublished(drafts: readonly Draft[], round: number, now: number): string {
  let latest = "";
  let latestAt = Number.NEGATIVE_INFINITY;
  for (const draft of drafts) {
    const at = Date.parse(draft.publishedAt);
    if (draft.round === round && !Number.isNaN(at) && at > latestAt) {
      latest = draft.publishedAt;
      latestAt = at;
    }
  }
  return latest === "" ? "" : shortTime(latest, now);
}

function roundsOf(drafts: readonly Draft[], now: number): DetailsRound[] {
  const rounds = [...new Set(drafts.map((draft) => draft.round))].sort((a, b) => a - b);
  if (rounds.length === 0) {
    return [{ text: "No drafts yet", time: "" }];
  }
  return rounds.map((round) => ({
    text: `Round ${round} · ${roundSummary(drafts, round)}`,
    time: lastPublished(drafts, round, now),
  }));
}

/**
 * discussionDetails is the Details panel of a discussion. repositories are the registered ones,
 * which know whether a clone is under way; without them none is.
 */
export function discussionDetails(
  discussion: DiscussionSummary,
  board: Board | null,
  now: number,
  repositories: readonly Repository[] = [],
): DiscussionDetailsModel {
  const reading = new Set((board?.cards ?? []).map((card) => card.key));
  const all = discussion.repositories ?? [];
  const title = board?.title ?? discussion.board;
  const effort = discussion.sessionEffort;
  return {
    discussion: {
      board:
        title === ""
          ? null
          : {
              title,
              detail: board === null ? "" : `${board.owner} · project ${board.number}`,
              open: board !== null,
            },
      cards: (discussion.cards ?? []).map((card) => ({
        number: card.number,
        title: card.title,
        inReading: reading.has(card.key),
        url: card.url,
      })),
      read: all
        .filter((repository) => repository.cloned && !repository.missing)
        .map((repository) => repository.fullName)
        .join(", "),
      notCloned: all
        .filter((repository) => !repository.cloned || repository.missing)
        .map((repository) => ({
          id: repository.id,
          fullName: repository.fullName,
          missing: repository.missing,
          cloning: repositories.find((one) => one.id === repository.id)?.cloning ?? false,
        })),
      model:
        discussion.sessionModel === ""
          ? ""
          : [modelLabel(discussion.sessionModel), effort].filter((part) => part !== "").join(" · "),
      started: startedTime(discussion.createdAt, now),
    },
    rounds: roundsOf(discussion.drafts ?? [], now),
    documents: [
      { name: "context.md", label: "Context", enabled: true },
      {
        name: "discussion.md",
        label: discussion.hasDocument
          ? "Document · discussion.md"
          : "Document · written with the drafts",
        enabled: discussion.hasDocument,
      },
    ],
  };
}
