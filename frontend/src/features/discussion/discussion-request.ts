import type { RequestButton, RequestModel } from "@/components/system/RequestBar";
import type { ComposerContext } from "@/features/chat/composer";
import type { DiscussionInput } from "@/features/chat/discussion-markers";
import { readyToArchiveDetail, standingDetail } from "@/features/discussion/discussion-status";
import {
  cardEntries,
  draftTitle,
  isDecided,
  nextToDecide,
} from "@/features/discussion/drafts-card";
import {
  type Bar,
  clean,
  drawn,
  type PendingRequest,
  sessionRequestOf,
  statusOf,
  TONES,
} from "@/features/task/request";
import type { RequestFocus } from "@/lib/focus";
import { compactWait, discussionSituation, lowerFirst, spokenWait } from "@/lib/situations";
import type { DiscussionSummary, Situation, SituationKind } from "@/lib/wails";
import {
  asDiscussionStatus,
  asDraftKind,
  asHoldReason,
  asSessionStatus,
  asSituationGroup,
  asSituationKind,
  DISCUSSION_STAGE,
} from "@/lib/wails";

/** DiscussionRequestAction is what a button of the request bar of a discussion does. */
export type DiscussionRequestAction = "show" | "retrySession" | "nextToDecide" | "archive";

/** DiscussionRequestModel is the request bar of the discussion screen. */
export type DiscussionRequestModel = RequestModel<DiscussionRequestAction, RequestFocus> & {
  /** target is the draft Show opens and the arrival focuses, with its Retry; null for none. */
  target: { draft: string; retry: boolean } | null;
};

type DiscussionButton = RequestButton<DiscussionRequestAction>;
type DiscussionBar = Omit<Bar<DiscussionRequestAction>, "focus"> & {
  focus: RequestFocus;
  target: DiscussionRequestModel["target"];
};

/** DiscussionKind is each situation of the drafts and of the state of the discussion. */
type DiscussionKind = Extract<
  SituationKind,
  "drafts" | "epic_cant_publish" | "epic_discarded" | "publish_failed" | "ready_to_archive"
>;

const DISCUSSION_KINDS: readonly SituationKind[] = [
  "drafts",
  "epic_cant_publish",
  "epic_discarded",
  "publish_failed",
  "ready_to_archive",
];

/** NEXT_TO_DECIDE goes to the next draft to decide, as Alt+↓ does. */
const NEXT_TO_DECIDE: DiscussionButton = {
  action: "nextToDecide",
  label: "Next to decide",
  variant: "secondary",
  shortcut: "Alt ↓",
  tooltip: "The next draft to decide · Alt+↓",
  loadingLabel: "",
};

const ARCHIVE: DiscussionButton = {
  action: "archive",
  label: "Archive…",
  variant: "primary",
  loadingLabel: "Archive…",
};

function showButton(tooltip?: string): DiscussionButton {
  return {
    action: "show",
    label: "Show",
    variant: "secondary",
    loadingLabel: "",
    ...(tooltip === undefined ? {} : { tooltip }),
  };
}

// placeOf is where the bar says the request is: Discussing before the drafts, round N after.
function placeOf(discussion: DiscussionSummary): string {
  return discussion.round === 0 ? "Discussing" : `round ${discussion.round}`;
}

// targetOf is the draft a bar of the drafts takes Show to: the first, in the order of the card, that holds.
function targetOf(
  discussion: DiscussionSummary,
  kind: DiscussionKind,
): DiscussionRequestModel["target"] {
  const entries = cardEntries(discussion);
  const drafts = entries.map((entry) => entry.draft);
  switch (kind) {
    case "drafts": {
      const draft = nextToDecide(entries, null, 1);
      return draft === null ? null : { draft, retry: false };
    }
    case "epic_cant_publish": {
      const epic = drafts.find(
        (draft) =>
          asDraftKind(draft.kind) === "epic" &&
          draft.decision === "approved" &&
          asHoldReason(draft.hold.reason) === "epic_short",
      );
      return epic === undefined ? null : { draft: epic.id, retry: false };
    }
    case "epic_discarded": {
      const epic = drafts.find(
        (draft) =>
          asDraftKind(draft.kind) === "epic" &&
          draft.decision === "discarded" &&
          drafts.some(
            (card) =>
              card.epic?.draft === draft.id &&
              card.decision === "approved" &&
              asHoldReason(card.hold.reason) === "epic_discarded",
          ),
      );
      return epic === undefined ? null : { draft: epic.id, retry: false };
    }
    case "publish_failed": {
      const failed = drafts.find((draft) => draft.publishError !== "");
      return failed === undefined ? null : { draft: failed.id, retry: true };
    }
    case "ready_to_archive":
      return null;
  }
}

function barOf(discussion: DiscussionSummary, kind: DiscussionKind): DiscussionBar {
  const place = placeOf(discussion);
  const target = targetOf(discussion, kind);
  switch (kind) {
    case "drafts": {
      const round = cardEntries(discussion).map((entry) => entry.draft);
      const decided = round.filter(isDecided).length;
      return {
        form: "decision",
        label: "Decide drafts",
        place,
        progress: `${decided} of ${round.length} decided`,
        status: statusOf("Decide drafts", place),
        actions: [NEXT_TO_DECIDE],
        focus: "draft",
        target,
      };
    }
    case "epic_cant_publish":
      return {
        form: "tinted",
        label: "Epic can't publish",
        place,
        progress: standingDetail(discussion) ?? "",
        status: statusOf("Epic can't publish", place),
        actions: [showButton("Go to the epic")],
        focus: "draft",
        target,
      };
    case "epic_discarded":
      return {
        form: "tinted",
        label: "Epic discarded",
        place,
        progress: standingDetail(discussion) ?? "",
        status: statusOf("Epic discarded", place),
        actions: [showButton()],
        focus: "draft",
        target,
      };
    case "publish_failed": {
      const failed = cardEntries(discussion).find((entry) => entry.draft.id === target?.draft);
      return {
        form: "error",
        label: "Publish failed",
        place,
        progress: failed === undefined ? "" : `Stopped at ${draftTitle(failed.draft)}`,
        status: statusOf("Publish failed", place),
        actions: [showButton("Go to the draft where the publication stopped; Retry is there")],
        focus: "draft",
        target,
      };
    }
    case "ready_to_archive":
      return {
        form: "closing",
        label: "Ready to archive",
        place,
        progress: readyToArchiveDetail(
          (discussion.drafts ?? []).filter((draft) => draft.published).length,
          discussion.round,
        ),
        status: statusOf("Ready to archive", place),
        actions: [ARCHIVE],
        focus: "primary",
        target,
      };
  }
}

// drawnBar draws a bar with its glyph and the situation it answers, with the focus the bar chose.
function drawnBar(situation: Situation, bar: DiscussionBar): DiscussionRequestModel {
  const { focus, target, ...rest } = bar;
  return { ...drawn(situation, rest), focus, target };
}

// pausedWant is the kind of the bar the state of a paused discussion asks for; null where only its session asked.
function pausedWant(discussion: DiscussionSummary): DiscussionKind | null {
  switch (asDiscussionStatus(discussion.status)) {
    case "deciding":
      return "drafts";
    case "epic_cant_publish":
      return "epic_cant_publish";
    case "epic_discarded":
      return "epic_discarded";
    case "publish_failed":
      return "publish_failed";
    case "ready_to_archive":
      return "ready_to_archive";
    case "discussing":
    case "awaiting_drafts":
    case "publishing":
      return null;
  }
}

// sessionBar is the bar of what the conversation asks: a question, a permission, a session error, a reply.
function sessionBar(
  discussion: DiscussionSummary,
  situation: Situation,
  pending: PendingRequest | null,
): DiscussionRequestModel {
  const session = {
    stage: discussion.sessionStage === "" ? DISCUSSION_STAGE : discussion.sessionStage,
    lastError: discussion.lastError,
  };
  const unreadable = discussion.unreadableDrafts !== "";
  const model = sessionRequestOf<DiscussionRequestAction>(
    situation,
    session,
    placeOf(discussion),
    pending,
    {
      label: unreadable ? "Waiting for the drafts" : "Waiting for reply",
      ...(unreadable ? { progress: "ask the agent to fix drafts.md below" } : {}),
      actions: [],
    },
  );
  return { ...model, target: null };
}

/**
 * discussionRequestOf is the request bar of the discussion screen: the situation of the discussion,
 * with its wait; paused, what the state asks for, quiet, without a chip and without what the session
 * asked; null for everything else. pending is the card the conversation holds pending.
 */
export function discussionRequestOf(
  discussion: DiscussionSummary,
  now: number,
  pending: PendingRequest | null,
): DiscussionRequestModel | null {
  if (asSessionStatus(discussion.sessionStatus) === "paused") {
    const kind = pausedWant(discussion);
    if (kind === null) {
      return null;
    }
    const { focus, target, ...rest } = barOf(discussion, kind);
    return { ...clean(rest), form: "quiet", glyph: "paused", situationId: null, focus, target };
  }
  const situation = discussionSituation(discussion);
  if (situation === null) {
    return null;
  }
  const kind = asSituationKind(situation.kind);
  const model = DISCUSSION_KINDS.includes(kind)
    ? drawnBar(situation, barOf(discussion, kind as DiscussionKind))
    : sessionBar(discussion, situation, pending);
  return {
    ...model,
    time: {
      short: compactWait(situation.startedAt, now),
      long: spokenWait(situation.startedAt, now),
      tone: TONES[asSituationGroup(situation.group)],
    },
  };
}

/**
 * discussionAnnouncement is what the live region says of a bar born with the discussion open:
 * "Usage-based pricing tiers: waiting for you: decide drafts in round 1", or "…: error: …".
 */
export function discussionAnnouncement(
  discussion: DiscussionSummary,
  request: DiscussionRequestModel,
): string {
  const tone = request.glyph === "error" ? "error" : "waiting for you";
  const where = request.place === undefined ? "" : ` in ${request.place}`;
  return `${discussion.title}: ${tone}: ${lowerFirst(request.label)}${where}`;
}

/** discussionInputOf is what the conversation of a discussion knows of it, for its markers. */
export function discussionInputOf(discussion: DiscussionSummary): DiscussionInput {
  return {
    id: discussion.id,
    drafts: discussion.drafts ?? [],
    text: discussion.text,
    cards: discussion.cards ?? [],
    documentRevision: discussion.documentRevision,
  };
}

/** DraftsComposer is what the composer offers about the drafts: to fix an unreadable file, to ask for changes, or the way to more cards. */
export type DraftsComposer = "unreadable" | "changes" | "archive" | null;

/** ComposerStarter is a starter of the composer: a pill that begins the message. */
export interface ComposerStarter {
  label: string;
  /** tooltip says what happens: "Starts the message: the agent revises the drafts…". */
  tooltip: string;
  /** text is what the click puts at the start of the box. */
  text: string;
}

/** DiscussionComposer is what the composer of a discussion needs of it, beside what a conversation tells. */
export type DiscussionComposer = Pick<
  ComposerContext,
  "findings" | "askForChange" | "reviseFindings" | "item" | "who"
> & { drafts: DraftsComposer };

/** discussionComposerContext is what the composer of a discussion says (material §4.2, O compositor). */
export function discussionComposerContext(discussion: DiscussionSummary): DiscussionComposer {
  const open = cardEntries(discussion).some(
    (entry) => !entry.draft.published && entry.draft.decision !== "discarded",
  );
  let kind: DraftsComposer = null;
  if (discussion.unreadableDrafts !== "") {
    kind = "unreadable";
  } else if (open) {
    kind = "changes";
  } else if (asDiscussionStatus(discussion.status) === "ready_to_archive") {
    kind = "archive";
  }
  return {
    findings: false,
    askForChange: false,
    reviseFindings: false,
    item: "discussion",
    who: "agent",
    drafts: kind,
  };
}

/** discussionStarters are the starters of the composer: Ask for changes, Ask to fix the drafts; empty for none. */
export function discussionStarters(discussion: DiscussionSummary): ComposerStarter[] {
  switch (discussionComposerContext(discussion).drafts) {
    case "unreadable":
      return [
        {
          label: "Ask to fix the drafts",
          tooltip: "Starts the message: the agent rewrites drafts.md in the format MySpec reads",
          text: `drafts.md can't be read: ${discussion.unreadableDrafts} Rewrite it in the format MySpec reads. `,
        },
      ];
    case "changes":
      return [
        {
          label: "Ask for changes",
          tooltip:
            "Starts the message: the agent revises the drafts and keeps your decisions on the ones it doesn't change",
          text: "Change the drafts: ",
        },
      ];
    case "archive":
    case null:
      return [];
  }
}

/** discussionOtherPrimary: the bar draws a primary, or a draft of the round failed (its Retry is the primary). */
export function discussionOtherPrimary(
  discussion: DiscussionSummary,
  request: DiscussionRequestModel | null,
): boolean {
  return (
    (request?.actions ?? []).some((action) => action.variant === "primary") ||
    cardEntries(discussion).some((entry) => entry.draft.publishError !== "")
  );
}
