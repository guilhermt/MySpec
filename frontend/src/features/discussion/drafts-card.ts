import { diffLines } from "diff";
import type {
  DecisionView,
  DependencyView,
  DiffLine,
  DraftStateView,
  GestureLineView,
} from "@/components/system/draft-views";
import { holdLabel, holdStands, kindLabel, refKey } from "@/features/discussion/discussion-status";
import { draftTitle } from "@/lib/drafts";
import { shortName } from "@/lib/repositories";
import { counted } from "@/lib/situations";
import type { DiscussionSummary, Draft, DraftDependency, DraftRef } from "@/lib/wails";
import { asDraftKind, asDraftOutcome, asHoldReason } from "@/lib/wails";
import { shortTime } from "@/lib/when";

/** LOCK_MS is how long A, D and the clicks of a decision stay inert after a decision. */
export const LOCK_MS = 900;

/** EPIC_TITLE_MAX is how long the title of an epic can be. */
export const EPIC_TITLE_MAX = 256;

/** isDecided: approved, discarded or on GitHub. */
export function isDecided(draft: Draft): boolean {
  return draft.decision !== "" || draft.published;
}

/** isStarted: GitHub has something of it (outcome !== ""). */
export function isStarted(draft: Draft): boolean {
  return asDraftOutcome(draft.outcome) !== "";
}

/** isBlocked: a draft not started whose repository the board no longer manages (repositoryId === ""). */
export function isBlocked(draft: Draft): boolean {
  return !isStarted(draft) && draft.repositoryId === "";
}

const isEpic = (draft: Draft): boolean => asDraftKind(draft.kind) === "epic";

const isUpdate = (draft: Draft): boolean => asDraftKind(draft.kind) === "update";

/** roundDrafts are the drafts of one round, in the order of their position. */
export function roundDrafts(drafts: readonly Draft[], round: number): Draft[] {
  return drafts.filter((draft) => draft.round === round).sort((a, b) => a.position - b.position);
}

/** CardEntry is one draft of the card, in the order of the screen. */
export interface CardEntry {
  draft: Draft;
  /** number is 1, 2… in the order of the screen. */
  number: number;
  /** epic is the epic draft whose group holds it, null for an epic or a loose card. */
  epic: Draft | null;
}

/**
 * cardEntries are the drafts of the current round in the order of the card: each epic by its
 * position with its cards under it, then the loose ones. A list of the markers asks for another
 * round by giving it as the current one.
 */
export function cardEntries(discussion: Pick<DiscussionSummary, "drafts" | "round">): CardEntry[] {
  const round = roundDrafts(discussion.drafts ?? [], discussion.round);
  const placed = new Set<string>();
  const entries: Omit<CardEntry, "number">[] = [];
  for (const epic of round.filter(isEpic)) {
    placed.add(epic.id);
    entries.push({ draft: epic, epic: null });
    for (const card of round) {
      if (!isEpic(card) && card.epic?.draft === epic.id) {
        placed.add(card.id);
        entries.push({ draft: card, epic });
      }
    }
  }
  for (const draft of round) {
    if (!placed.has(draft.id)) {
      entries.push({ draft, epic: null });
    }
  }
  return entries.map((entry, index) => ({ ...entry, number: index + 1 }));
}

/** epicGroupLabel names the group of an epic: "Epic Pricing tiers with metered overage and its 3 cards". */
export function epicGroupLabel(epic: Draft, members: number): string {
  return `Epic ${draftTitle(epic)} and its ${counted(members, "card")}`;
}

/** nextToDecide is the next (by 1) or previous (by -1) draft to decide after `from`, with the turn around; null when none is left. From null, the first (or the last). */
export function nextToDecide(
  entries: readonly CardEntry[],
  from: string | null,
  by: 1 | -1,
): string | null {
  const start = entries.findIndex((entry) => entry.draft.id === from);
  const first = start === -1;
  const total = entries.length;
  // From nothing the walk starts at an end and visits every draft; from a draft it visits the others.
  const steps = first ? total : total - 1;
  for (let step = 1; step <= steps; step += 1) {
    const index = first
      ? by === 1
        ? step - 1
        : total - step
      : (((start + by * step) % total) + total) % total;
    const entry = entries[index];
    if (entry !== undefined && !isDecided(entry.draft)) {
      return entry.draft.id;
    }
  }
  return null;
}

// shortRef is an issue as the screen writes it, "billing#479" for "acme/billing#479".
function shortRef(reference: string): string {
  const hash = reference.lastIndexOf("#");
  return hash === -1 ? reference : `${shortName(reference.slice(0, hash))}${reference.slice(hash)}`;
}

// issueOf is the issue a started draft made or changed, null before it has a number.
function issueOf(draft: Draft): { label: string; url: string } | null {
  const number = draft.number > 0 ? draft.number : (draft.card?.number ?? 0);
  return number === 0
    ? null
    : { label: `${shortName(draft.repository)}#${number}`, url: draft.url };
}

const NO_STATE: Omit<DraftStateView, "open" | "folded"> = {
  glyph: null,
  strong: false,
  link: null,
  time: "",
  wayBack: "",
  created: null,
};

function publishedState(draft: Draft, now: number): DraftStateView {
  const link = issueOf(draft);
  const updated = asDraftOutcome(draft.outcome) === "updated";
  const time = shortTime(draft.publishedAt, now);
  const text = [`${updated ? "Updated" : "Created"} ${link?.label ?? ""}`.trimEnd(), time]
    .filter((part) => part !== "")
    .join(" · ");
  return {
    ...NO_STATE,
    open: text,
    folded: text,
    glyph: "check",
    link,
    time,
    wayBack:
      link === null
        ? ""
        : `To take it back, ${updated ? "edit" : "close"} ${link.label} on GitHub.`,
  };
}

const blockedFolded = (draft: Draft): string =>
  isUpdate(draft)
    ? "Can't publish · the repository left the board"
    : "Can't publish · choose a repository";

/** draftStateOf is where a draft stands, by the first case that holds (material §4.2, O estado). */
export function draftStateOf(draft: Draft, now: number): DraftStateView {
  if (draft.published) {
    return publishedState(draft, now);
  }
  if (draft.publishing) {
    return { ...NO_STATE, open: "Publishing…", folded: "Publishing…", glyph: "spinner" };
  }
  if (draft.publishError !== "") {
    return {
      ...NO_STATE,
      open: draft.publishError,
      folded: "Couldn't write to GitHub · open it to Retry",
      glyph: "error",
      created: isStarted(draft) ? issueOf(draft) : null,
    };
  }
  if (draft.decision === "discarded") {
    return { ...NO_STATE, open: "Discarded", folded: "Discarded" };
  }
  if (draft.decision === "approved") {
    const hold = holdLabel(draft);
    if (hold !== null) {
      return { ...NO_STATE, open: hold, folded: hold, glyph: "hold", strong: holdStands(draft) };
    }
    return {
      ...NO_STATE,
      open: "Approved · publishing next",
      folded: "Approved · publishing next",
    };
  }
  if (isBlocked(draft)) {
    return { ...NO_STATE, open: null, folded: blockedFolded(draft), glyph: "blocked" };
  }
  if (draft.approvalCleared) {
    return {
      ...NO_STATE,
      open: "Revised · your approval was cleared",
      folded: "Revised · approval cleared",
    };
  }
  return { ...NO_STATE, open: null, folded: "Not decided" };
}

// membersOf are the cards of the round an epic holds.
function membersOf(epic: Draft, discussion: DiscussionSummary): Draft[] {
  return roundDrafts(discussion.drafts ?? [], epic.round).filter(
    (draft) => !isEpic(draft) && draft.epic?.draft === epic.id,
  );
}

// existingEpic is the epic of a draft that is an issue on GitHub: "billing#478 Pricing tiers".
function existingEpic(draft: Draft): string | null {
  const epic = draft.epic;
  if (epic === null || epic.draft !== "") {
    return null;
  }
  return [shortRef(epic.reference), epic.title].filter((part) => part !== "").join(" ");
}

// epicNow is the epic a card has on GitHub, as Epic now says it.
function epicNow(ref: DraftRef | null): string {
  return ref === null
    ? "none"
    : [shortRef(ref.reference), ref.title].filter((part) => part !== "").join(" ");
}

// pieces joins the parts of a line that say something by " · ".
function pieces(...all: (string | null)[]): string {
  return all.filter((part): part is string => part !== null && part !== "").join(" · ");
}

/** foldedLine2 is the second line of a folded draft, parts by " · " (material §4.2, O dobrado). */
export function foldedLine2(draft: Draft, discussion: DiscussionSummary): string {
  const epic = existingEpic(draft);
  const depends = dependencyViews(draft, discussion).map((view) => view.title);
  const warnings = warningsOf(draft, { kind: "fresh" }).length;
  const current = draft.current;
  return pieces(
    draft.repository,
    draft.module,
    isEpic(draft) ? counted(membersOf(draft, discussion).length, "card") : null,
    isUpdate(draft) && current !== null && current.title !== draft.title
      ? `Now: ${current.title}`
      : null,
    epic === null ? null : `In ${epic}`,
    depends.length > 0 ? `Depends on ${depends.join(", ")}` : null,
    warnings > 0 ? counted(warnings, "warning") : null,
  );
}

/** fieldsLine is the line of fields of the open draft, parts by " · " (material §4.2, O aberto, Campos). */
export function fieldsLine(draft: Draft, discussion: DiscussionSummary): string {
  const epic = existingEpic(draft);
  const now = isUpdate(draft) ? draft.current : null;
  return pieces(
    draft.repository,
    draft.module,
    isEpic(draft) ? counted(membersOf(draft, discussion).length, "card") : null,
    epic === null ? null : `In ${epic}`,
    now !== null && now.title !== draft.title ? `Now: ${now.title}` : null,
    now !== null && now.module !== draft.module ? `Module now: ${now.module || "none"}` : null,
    now !== null && refKeyOf(now.epic) !== refKeyOf(draft.epic)
      ? `Epic now: ${epicNow(now.epic)}`
      : null,
  );
}

// refKeyOf is the identity of what a draft points at as its epic, "" for none.
function refKeyOf(ref: DraftRef | null): string {
  return ref === null ? "" : refKey(ref);
}

function dependencyView(
  dependency: DraftDependency,
  discussion: DiscussionSummary,
): DependencyView {
  const pointed =
    dependency.draft === ""
      ? undefined
      : (discussion.drafts ?? []).find((draft) => draft.id === dependency.draft);
  const title =
    dependency.title !== ""
      ? dependency.title
      : pointed !== undefined
        ? draftTitle(pointed)
        : dependency.reference;
  const current = pointed !== undefined && pointed.round === discussion.round;
  return {
    title,
    draft: current ? dependency.draft : null,
    url: current ? "" : pointed !== undefined ? pointed.url : dependency.url,
    linked: dependency.linked,
  };
}

/** dependencyViews are the dependencies of a draft that haven't left, by title. */
export function dependencyViews(draft: Draft, discussion: DiscussionSummary): DependencyView[] {
  return (draft.dependencies ?? [])
    .filter((dependency) => dependency.dropped === "")
    .map((dependency) => dependencyView(dependency, discussion));
}

/** onGitHub are the dependencies of the card of an update that the draft doesn't say: "#455, #470"; "" without. */
export function onGitHub(draft: Draft): string {
  const said = new Set((draft.dependencies ?? []).map(refKey));
  return (draft.current?.dependencies ?? [])
    .filter((dependency) => !said.has(refKey(dependency)))
    .map((dependency) => /#\d+$/.exec(dependency.reference)?.[0] ?? dependency.reference)
    .join(", ");
}

/** CardRefresh is where the reading again of the card of an update stands. */
export type CardRefresh =
  | { kind: "fresh" }
  | { kind: "missing" }
  | { kind: "refreshing" }
  | { kind: "failed"; reason: string };

/** warningsOf are the warnings of a draft, each one line (material §4.2, O aberto, Avisos). */
export function warningsOf(draft: Draft, refresh: CardRefresh): string[] {
  const warnings: string[] = [];
  if (isBlocked(draft) && draft.repository !== "") {
    warnings.push(`${draft.repository} is no longer managed by the board.`);
  }
  warnings.push(...(draft.warnings ?? []));
  switch (refresh.kind) {
    case "missing":
      warnings.push("This card isn't in the last reading of the board.");
      break;
    case "refreshing":
      warnings.push("Refreshing the card…");
      break;
    case "failed":
      warnings.push(
        `Couldn't refresh the card: ${refresh.reason}. The draft shows the last reading.`,
      );
      break;
    case "fresh":
      break;
  }
  return warnings;
}

// sentence ends a text with a period unless it ends in a mark already.
function sentence(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/** accessibleName is the name of a draft, open or folded: "Draft 3 of 5: New card. Overage on the monthly invoice. acme/billing, Billing. Approved, waits for the epic." */
export function accessibleName(
  entry: CardEntry,
  total: number,
  draft: Draft,
  _discussion: DiscussionSummary,
  now: number,
): string {
  const where = [draft.repository, draft.module].filter((part) => part !== "").join(", ");
  const state = draftStateOf(draft, now).folded.replaceAll(" · ", ", ");
  return [
    `Draft ${entry.number} of ${total}: ${sentence(kindLabel(draft))}`,
    sentence(draftTitle(draft)),
    where === "" ? "" : sentence(where),
    sentence(state),
  ]
    .filter((part) => part !== "")
    .join(" ");
}

// nameOf is how the line calls a draft of the chain.
function nameOf(id: string, self: Draft, drafts: readonly Draft[]): string {
  if (id === self.id) {
    return isEpic(self) ? "the epic" : "this card";
  }
  if (id === self.epic?.draft) {
    return "the epic";
  }
  const other = drafts.find((draft) => draft.id === id);
  if (other === undefined) {
    return "another draft";
  }
  return isEpic(other) ? `the epic ${draftTitle(other)}` : draftTitle(other);
}

// names joins the names of a chain by ", " with " and " before the last.
function names(ids: readonly string[], self: Draft, drafts: readonly Draft[]): string {
  const all = ids.map((id) => nameOf(id, self, drafts));
  const last = all.at(-1);
  if (all.length < 2 || last === undefined) {
    return all.join("");
  }
  return `${all.slice(0, -1).join(", ")} and ${last}`;
}

// blockedText is why a draft can't publish, as the gesture line and the reason of Approve say it.
function blockedText(draft: Draft): string {
  return isUpdate(draft)
    ? `Can't publish: ${draft.repository} is no longer managed by the board.`
    : "Can't publish: choose a repository of the board in Edit.";
}

// holdPhrase is what Approve waits for, after "Approve publishes nothing yet: ".
function holdPhrase(draft: Draft): string | null {
  const { approveHold: hold } = draft;
  const subject = isEpic(draft) ? "the epic" : "this card";
  switch (asHoldReason(hold.reason)) {
    case "epic":
      return "this card waits for the epic.";
    case "draft":
      return `this card waits for ${hold.title}.`;
    case "cards":
      return `${subject} waits for ${counted(hold.left, "more card")} of the epic to be decided.`;
    case "epic_short":
      return hold.cards === 0
        ? "the epic has no cards."
        : `the epic needs two approved cards · ${hold.approved} of ${hold.cards}.`;
    case "epic_discarded":
    case "":
      return null;
  }
}

type Segment = { text: string; strong: boolean };

// lineOf builds the line from its segments, joining neighbours that read the same.
function lineOf(icon: GestureLineView["icon"], pieces: Segment[]): GestureLineView {
  const segments: Segment[] = [];
  for (const piece of pieces) {
    const last = segments.at(-1);
    if (last !== undefined && last.strong === piece.strong) {
      last.text += piece.text;
    } else {
      segments.push({ ...piece });
    }
  }
  return { icon, segments, text: segments.map((segment) => segment.text).join("") };
}

/** gestureLineOf is the gesture line of a draft (material §4.2, A linha do gesto); null where it isn't drawn. */
export function gestureLineOf(
  draft: Draft,
  discussion: DiscussionSummary,
  editing: boolean,
): GestureLineView | null {
  if (
    draft.decision !== "" ||
    isStarted(draft) ||
    discussion.publishing ||
    editing ||
    draft.title.trim() === ""
  ) {
    return null;
  }
  const drafts = discussion.drafts ?? [];
  const approves = draft.approvePublishes ?? [];
  const discards = draft.discardPublishes ?? [];
  const discard: Segment[] =
    discards.length === 0
      ? []
      : [
          { text: " ", strong: false },
          { text: "Discard", strong: true },
          { text: ` publishes ${names(discards, draft, drafts)} now.`, strong: false },
        ];
  if (isBlocked(draft)) {
    return lineOf("blocked", [{ text: blockedText(draft), strong: false }]);
  }
  if (approves.length > 0) {
    return lineOf(approves.length > 1 || discards.length > 0 ? "chain" : "hourglass", [
      { text: "Approve", strong: true },
      { text: ` publishes ${names(approves, draft, drafts)} to GitHub now.`, strong: false },
      ...discard,
    ]);
  }
  const holdReason = asHoldReason(draft.approveHold.reason);
  if (holdReason === "epic_discarded") {
    return lineOf("hourglass", [
      { text: "Approve", strong: true },
      {
        text: " publishes nothing: the epic is discarded, so this card won't publish.",
        strong: false,
      },
    ]);
  }
  const phrase = holdPhrase(draft);
  if (phrase !== null) {
    return lineOf(discards.length > 0 ? "chain" : "hourglass", [
      { text: "Approve", strong: true },
      { text: ` publishes nothing yet: ${phrase}`, strong: false },
      ...discard,
    ]);
  }
  if (discards.length > 0) {
    return lineOf("chain", discard.slice(1));
  }
  return null;
}

/** decisionOf is what the decision of a draft allows now. */
export function decisionOf(
  draft: Draft,
  discussion: DiscussionSummary,
  editing: boolean,
): DecisionView {
  if (isStarted(draft)) {
    return { shown: false, approveReason: null, discardReason: null, editReason: null };
  }
  const editReason = discussion.publishing ? "A publication is running" : null;
  const both = discussion.publishing
    ? "A publication is running · the decision waits for it"
    : editing
      ? "Finish editing to decide"
      : null;
  if (both !== null) {
    return { shown: true, approveReason: both, discardReason: both, editReason };
  }
  let approveReason: string | null = null;
  // Approve on a decided draft is the undo, which neither a missing title nor the board stops.
  if (draft.decision !== "") {
    approveReason = null;
  } else if (draft.title.trim() === "") {
    approveReason = "Name the draft to approve it.";
  } else if (isBlocked(draft)) {
    approveReason = blockedText(draft);
  }
  return { shown: true, approveReason, discardReason: null, editReason };
}

/** advanceAfter says whether a decision moves on to the next draft to decide ("advance") or keeps the focus ("stay"), from the screen as it was at the gesture. */
export function advanceAfter(draft: Draft, key: "approve" | "discard"): "advance" | "stay" {
  if (draft.decision !== "") {
    return "stay";
  }
  const publishes = key === "approve" ? draft.approvePublishes : draft.discardPublishes;
  return (publishes ?? []).length > 0 ? "stay" : "advance";
}

// A body reads by its lines: neither the carriage returns of a body typed on
// GitHub nor whether it ends in a newline is a change of a line. The Go side
// strips the carriage returns of the drafts the same way.
function whole(value: string): string {
  const text = value.replaceAll("\r", "");
  return text === "" || text.endsWith("\n") ? text : `${text}\n`;
}

// A change of jsdiff carries whole lines, each with its newline; the empty tail
// the split leaves behind is no line at all.
function linesOf(value: string): string[] {
  const lines = value.split("\n");
  return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
}

// What a change of jsdiff says of its lines.
function kindOf(change: { added?: boolean; removed?: boolean }): DiffLine["kind"] {
  if (change.added === true) {
    return "added";
  }
  return change.removed === true ? "removed" : "same";
}

/**
 * bodyDiff is the change from the body on GitHub to the body of the draft, line by line: the lines
 * both texts share, the ones the draft adds and the ones it takes away, in the order they read.
 */
export function bodyDiff(current: string, next: string): DiffLine[] {
  return diffLines(whole(current), whole(next)).flatMap((change) => {
    const kind = kindOf(change);
    return linesOf(change.value).map((text): DiffLine => ({ kind, text }));
  });
}

/** diffCount is "+4 −1": the lines added and removed; "" without a change. */
export function diffCount(lines: readonly DiffLine[]): string {
  const added = lines.filter((line) => line.kind === "added").length;
  const removed = lines.filter((line) => line.kind === "removed").length;
  return [added > 0 ? `+${added}` : "", removed > 0 ? `−${removed}` : ""]
    .filter((part) => part !== "")
    .join(" ");
}

/**
 * groupable are the drafts the dialog Group drafts into an epic offers: cards of the current round,
 * loose, not started, not discarded, in the order of the card. A card whose epic is a draft of an
 * earlier round stands loose on the card but is not loose: it is published with that epic.
 */
export function groupable(discussion: DiscussionSummary): Draft[] {
  return cardEntries(discussion)
    .filter(
      ({ draft, epic }) =>
        epic === null &&
        !isEpic(draft) &&
        (draft.epic === null || draft.epic.draft === "") &&
        !isStarted(draft) &&
        draft.decision !== "discarded",
    )
    .map((entry) => entry.draft);
}

/** groupReason is the reason of the footer of the dialog: "Name the epic to group the drafts.", "Pick two drafts or more."; null when it groups. */
export function groupReason(title: string, picked: number): string | null {
  const trimmed = title.trim();
  if (trimmed === "") {
    return "Name the epic to group the drafts.";
  }
  if (picked < 2) {
    return "Pick two drafts or more.";
  }
  return [...trimmed].length > EPIC_TITLE_MAX
    ? `Use at most ${EPIC_TITLE_MAX} characters in the title of the epic.`
    : null;
}

export type { DecisionView, DependencyView, DiffLine, DraftStateView, GestureLineView };
