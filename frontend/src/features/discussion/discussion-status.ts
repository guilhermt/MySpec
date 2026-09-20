import type { StatusTone } from "@/features/task/status";
import { summaryLabel } from "@/lib/situations";
import type { DiscussionRepository, DiscussionSummary, Draft, DraftDependency } from "@/lib/wails";
import { asDiscussionStatus, asDraftKind, asDraftOutcome } from "@/lib/wails";

/** EpicGroup is an epic of a discussion with the cards that belong to it. */
export interface EpicGroup {
  epic: Draft;
  members: Draft[];
}

/** discussionStatusLabel is where a discussion stands, in the words of the product. */
export function discussionStatusLabel(discussion: DiscussionSummary): string {
  switch (asDiscussionStatus(discussion.status)) {
    case "discussing":
      return "Discussing";
    case "awaiting_drafts":
      return "Waiting for the drafts";
    case "deciding":
      return "Decide drafts";
    case "publishing":
      return "Publishing";
    case "publish_failed":
      return "Publish failed";
    case "published":
      return "Drafts published";
  }
}

/**
 * discussionStatusTone maps the state of a discussion to the colour that
 * carries it. It never calls for the user: that colour comes from the
 * situations alone.
 */
export function discussionStatusTone(discussion: DiscussionSummary): StatusTone {
  switch (asDiscussionStatus(discussion.status)) {
    case "publishing":
      return "working";
    case "published":
      return "done";
    case "discussing":
    case "awaiting_drafts":
    case "deciding":
    case "publish_failed":
      return "idle";
  }
}

/**
 * discussionRowLabel is what a row of a discussion reads: what it waits on the
 * user for, and, when it waits for nothing, what it is doing.
 */
export function discussionRowLabel(discussion: DiscussionSummary): string {
  return summaryLabel(discussion.situations ?? []) ?? discussionStatusLabel(discussion);
}

/**
 * decidedCount is how many drafts the user has already approved or discarded.
 * A published draft is decided by definition: it only got there approved.
 */
export function decidedCount(drafts: readonly Draft[]): number {
  return drafts.filter((draft) => draft.decision !== "" || draft.published).length;
}

/** draftsSummary is how far the user is through the drafts. */
export function draftsSummary(drafts: readonly Draft[]): string {
  return `${decidedCount(drafts)} of ${drafts.length} decided`;
}

/** kindLabel names what a draft would do on GitHub. */
export function kindLabel(draft: Draft): string {
  switch (asDraftKind(draft.kind)) {
    case "new":
      return "New card";
    case "update":
      return "Update";
    case "epic":
      return "Epic";
  }
}

/** outcomeLabel is what the publication did with a draft. */
export function outcomeLabel(draft: Draft): string {
  switch (asDraftOutcome(draft.outcome)) {
    case "created":
      return "Created";
    case "updated":
      return "Updated";
    case "":
      return "Not published";
  }
}

/**
 * epicGroups are the epics of a discussion with their cards, in the order the
 * epics sit in. A card belongs to an epic when it points at a draft of the
 * discussion; one that points at an issue on GitHub belongs to no group.
 */
export function epicGroups(drafts: readonly Draft[]): EpicGroup[] {
  return drafts
    .filter((draft) => asDraftKind(draft.kind) === "epic")
    .map((epic) => ({
      epic,
      members: drafts.filter((draft) => draft.epic?.draft === epic.id),
    }));
}

/** looseDrafts are the drafts that belong to no epic of the discussion. */
export function looseDrafts(drafts: readonly Draft[]): Draft[] {
  const grouped = new Set(
    epicGroups(drafts).flatMap((group) => [group.epic.id, ...group.members.map((one) => one.id)]),
  );
  return drafts.filter((draft) => !grouped.has(draft.id));
}

/** dependencyLabel names what a draft waits for: another draft, or an issue. */
export function dependencyLabel(dependency: DraftDependency): string {
  if (dependency.reference === "") {
    return dependency.title === "" ? dependency.draft : dependency.title;
  }
  return dependency.title === ""
    ? dependency.reference
    : `${dependency.reference} · ${dependency.title}`;
}

/** waitsLabel says what holds the publication of a draft back. */
export function waitsLabel(draft: Draft): string {
  return `Waits for ${draft.waits}`;
}

/**
 * repositoryOf is the repository of the board a draft is created in, null when
 * the draft points at none the board still has.
 */
export function repositoryOf(
  draft: Draft,
  discussion: DiscussionSummary,
): DiscussionRepository | null {
  if (draft.repositoryId === "") {
    return null;
  }
  return (
    (discussion.repositories ?? []).find((repository) => repository.id === draft.repositoryId) ??
    null
  );
}
