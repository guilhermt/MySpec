import { counted } from "@/lib/situations";
import type { Draft, DraftDependency, DraftRef } from "@/lib/wails";
import { asDraftKind, asDraftOutcome, asHoldReason } from "@/lib/wails";

/** EpicGroup is an epic of a discussion with the cards that belong to it. */
export interface EpicGroup {
  epic: Draft;
  members: Draft[];
}

/** holdLabel is what keeps an approved draft out of the next publication, null when nothing does. */
export function holdLabel(draft: Draft): string | null {
  const { hold } = draft;
  switch (asHoldReason(hold.reason)) {
    case "epic_discarded":
      return "The epic is discarded · this card won't publish";
    case "cards":
      return `Approved · waits for ${counted(hold.left, "more card")} of the epic to be decided`;
    case "epic_short":
      return hold.cards === 0
        ? "Approved · the epic has no cards"
        : `Approved · the epic needs two approved cards · ${hold.approved} of ${hold.cards}`;
    case "epic":
      return "Approved · waits for the epic";
    case "draft":
      return `Approved · waits for ${hold.title}`;
    case "":
      return null;
  }
}

/** holdStands says the hold of a draft is a way out the user takes, which reads stronger. */
export function holdStands(draft: Draft): boolean {
  const reason = asHoldReason(draft.hold.reason);
  return reason === "epic_short" || reason === "epic_discarded";
}

/** epicWayOut is what the bar says of an epic that can't publish: how far it is, and the way out. */
export function epicWayOut(approved: number, cards: number): string {
  if (cards === 0) {
    return "No cards · move two cards into it, or discard the epic";
  }
  if (cards === 1) {
    return `${approved} of 1 card approved · move another card into it, or discard the epic`;
  }
  const more = approved === 1 ? "one" : "two";
  return `${approved} of ${cards} cards approved · approve ${more} more, or discard the epic`;
}

/** epicDiscardedDetail is what the bar says of the approved cards of a discarded epic. */
export function epicDiscardedDetail(approvedCards: number): string {
  return approvedCards === 1
    ? "1 approved card of it won't publish · approve the epic again, or discard it"
    : `${approvedCards} approved cards of it won't publish · approve the epic again, or discard them`;
}

/** readyToArchiveDetail is what the bar says of a discussion ready to archive: what was published, in how many rounds when more than one. */
export function readyToArchiveDetail(published: number, rounds = 1): string {
  const where = published > 0 && rounds > 1 ? ` in ${rounds} rounds` : "";
  return `${published === 0 ? "nothing" : published} published${where} · or ask the agent for more cards below`;
}

/** StandingKind is each situation whose bar names an epic: one that can't publish, or one discarded. */
export type StandingKind = "epic_cant_publish" | "epic_discarded";

// heldByDiscarded are the approved cards a discarded epic keeps from publishing.
function heldByDiscarded(epic: Draft, drafts: readonly Draft[]): number {
  return drafts.filter(
    (draft) =>
      draft.epic?.draft === epic.id &&
      draft.decision === "approved" &&
      asHoldReason(draft.hold.reason) === "epic_discarded",
  ).length;
}

/**
 * standingEpic is the epic the bar of the situation names, among the drafts given (those of the
 * round): the first approved epic that can't publish, or the first discarded one that holds an
 * approved card; undefined when none does.
 */
export function standingEpic(kind: StandingKind, drafts: readonly Draft[]): Draft | undefined {
  return drafts.find((draft) => {
    if (asDraftKind(draft.kind) !== "epic") {
      return false;
    }
    return kind === "epic_cant_publish"
      ? draft.decision === "approved" && asHoldReason(draft.hold.reason) === "epic_short"
      : draft.decision === "discarded" && heldByDiscarded(draft, drafts) > 0;
  });
}

/** standingDetail is the middle of the bar of the situation, of the epic standingEpic names; null when none does. */
export function standingDetail(kind: StandingKind, drafts: readonly Draft[]): string | null {
  const epic = standingEpic(kind, drafts);
  if (epic === undefined) {
    return null;
  }
  return kind === "epic_cant_publish"
    ? epicWayOut(epic.hold.approved, epic.hold.cards)
    : epicDiscardedDetail(heldByDiscarded(epic, drafts));
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

/**
 * DependencyRef is what one dependency line reads from: a dependency of a
 * draft, or one the card already has on GitHub.
 */
export type DependencyRef = DraftDependency | DraftRef;

/**
 * refKey identifies what a reference points at, so that two ways of writing
 * the same issue are one, as Ref.Key does on the Go side.
 */
export function refKey(ref: DependencyRef): string {
  return ref.draft === "" ? ref.key : `draft:${ref.draft}`;
}

/**
 * refValue is the reference the Go side takes a draft or an issue by: the id
 * of a draft, or the issue as the draft writes it.
 */
export function refValue(ref: DependencyRef): string {
  return ref.draft === "" ? ref.reference : ref.draft;
}

/** dependencyLabel names what a draft waits for: another draft, or an issue. */
export function dependencyLabel(dependency: DependencyRef): string {
  if (dependency.reference === "") {
    return dependency.title === "" ? dependency.draft : dependency.title;
  }
  return dependency.title === ""
    ? dependency.reference
    : `${dependency.reference} · ${dependency.title}`;
}

/**
 * epicRepositoryOf is the repository an epic over these drafts starts in: the
 * most common one among them, ties going to the first by owner/name, and "" when
 * none of them has one.
 */
export function epicRepositoryOf(drafts: readonly Draft[]): string {
  const counts = new Map<string, { id: string; count: number }>();
  for (const draft of drafts) {
    if (draft.repositoryId === "") {
      continue;
    }
    const entry = counts.get(draft.repository) ?? { id: draft.repositoryId, count: 0 };
    entry.count += 1;
    counts.set(draft.repository, entry);
  }
  let best = "";
  let bestCount = 0;
  for (const fullName of [...counts.keys()].sort()) {
    const { count } = counts.get(fullName) ?? { count: 0 };
    if (count > bestCount) {
      best = fullName;
      bestCount = count;
    }
  }
  return counts.get(best)?.id ?? "";
}
