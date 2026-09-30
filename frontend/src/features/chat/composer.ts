import { fencedLines } from "@/features/chat/code-cut";
import {
  asPermissionStatus,
  type Entry,
  type PermissionEntry,
  type Question,
  type QuestionEntry,
} from "@/lib/wails";

/**
 * QuestionChoices is what the question card has chosen, by the index of each question: the labels
 * picked, and the text of Other… ("" once Other… is chosen and before its text, null without it).
 */
export type QuestionChoices = Record<number, { labels: string[]; other: string | null }>;

/** QuickReply is one quick reply of the composer: the key it sends and the start of the option. */
export interface QuickReply {
  /** key is the letter or the number as the agent wrote it: "a", "1". */
  key: string;
  /** text is the start of the option, at most QUICK_REPLY_MAX characters, cut at a word with "…". */
  text: string;
}

/** ComposerContext is what the composer needs to know to say whom it answers, and how. */
export interface ComposerContext {
  /** who is whom the conversation talks to, inside a sentence: "implementer", "PRD agent" (speaker()). */
  who: string;
  paused: boolean;
  /** stopped is the session having stopped on an error: lastError !== "". */
  stopped: boolean;
  /** turnFailed is the last turn ending in an error the session survived. */
  turnFailed: boolean;
  turnRunning: boolean;
  /** question is the question pending in the conversation, null without one. */
  question: QuestionEntry | null;
  /** choices are what the card of the pending question has chosen, null before any choice. */
  choices: QuestionChoices | null;
  /** otherHeader is the header of the question whose Other… is chosen on the card, null without one. */
  otherHeader: string | null;
  /** permission is a permission pending in the conversation. */
  permission: boolean;
  /** chips are the quick replies of the question in text, empty without one. */
  chips: QuickReply[];
  /** findings is the pull request of the task waiting for its findings to be decided. */
  findings: boolean;
  /** askForChange is the step on screen in review by the user, or without changes. */
  askForChange: boolean;
  /** reviseFindings is a pass of the review with findings not published. */
  reviseFindings: boolean;
  /** item is what a paused conversation resumes: task, review. */
  item: string;
}

/** QUICK_REPLY_MAX is the most characters of an option a quick reply shows, "…" included. */
export const QUICK_REPLY_MAX = 48;

// The fewest and the most options of a question in text that become quick replies.
const MIN_REPLIES = 2;
const MAX_REPLIES = 6;

// A line that starts an item of a list: a bullet, 1. or 1), a) or (a), **a)**.
const LIST_ITEM = /^\s{0,3}(?:[-*+]|\d+[.)]|(?:\*\*)?\(?[a-hA-H]\)(?:\*\*)?)\s+/;

// An option labelled with a letter: a), A), (a) or **a)**, after a bullet or not.
const LETTER_OPTION = /^\s{0,3}(?:[-*+]\s+)?(?:\*\*)?\(?([a-hA-H])\)(?:\*\*)?\s+(\S.*)$/;

// An option of a numbered list: 1. to 8.
const NUMBER_OPTION = /^\s{0,3}([1-8])\.\s+(\S.*)$/;

/** composerLabelOf is the accessible name of the composer: "Reply to the implementer". */
export function composerLabelOf(who: string): string {
  return `Reply to the ${who}`;
}

// alternatives reads keys as a choice: "a or b", "a, b or c".
function alternatives(keys: readonly string[]): string {
  const last = keys.at(-1) ?? "";
  return keys.length < 2 ? last : `${keys.slice(0, -1).join(", ")} or ${last}`;
}

function hasChoice(choice: QuestionChoices[number] | undefined): boolean {
  if (choice === undefined) {
    return false;
  }
  return choice.labels.length > 0 || (choice.other !== null && choice.other.trim() !== "");
}

// questionPlaceholder is the placeholder with a question pending: the keys of its options, or with
// several questions, the first one still without a choice.
function questionPlaceholder(
  questions: readonly Question[],
  choices: QuestionChoices,
  who: string,
): string {
  if (questions.length > 1) {
    const open = questions.find((_, index) => !hasChoice(choices[index])) ?? questions[0];
    return `Write your answer to “${open?.header ?? ""}”, or choose above…`;
  }
  // The keys run over the options and Other…, the last one.
  const keys = (questions[0]?.options ?? []).length + 1;
  return `Answer with ${keys > 1 ? `1–${keys}` : "1"}, or reply to the ${who}…`;
}

/** placeholderOf is the placeholder of the composer: the first moment of the table Placeholders that holds. */
export function placeholderOf(c: ComposerContext): string {
  const questions = c.question?.questions ?? [];
  if (c.otherHeader !== null) {
    return `Write your answer to “${c.otherHeader}” and press Enter…`;
  }
  if (c.paused) {
    return `Sending resumes the ${c.item}…`;
  }
  if (c.stopped) {
    return `Sending restarts the ${c.who}'s session…`;
  }
  if (c.turnFailed) {
    return `Reply to the ${c.who} to go on…`;
  }
  if (questions.length > 0) {
    return questionPlaceholder(questions, c.choices ?? {}, c.who);
  }
  if (c.permission) {
    return `Answer with 1–3 above, or queue a message for the ${c.who}…`;
  }
  if (c.turnRunning) {
    return `Queue a message for the ${c.who}…`;
  }
  if (c.chips.length > 0) {
    return `Answer ${alternatives(c.chips.map((chip) => chip.key))}, or reply to the ${c.who}…`;
  }
  if (c.reviseFindings) {
    return `Ask the ${c.who} to add, change or drop a finding…`;
  }
  if (c.findings) {
    return `Tell the ${c.who} which findings to apply…`;
  }
  if (c.askForChange) {
    return `Ask the ${c.who} for a change…`;
  }
  return `Reply to the ${c.who}…`;
}

// isListBlock reports whether a block of lines is a list: its first line starts an item.
function isListBlock(block: readonly string[]): boolean {
  return LIST_ITEM.test(block[0] ?? "");
}

// blocksOf splits Markdown at its blank lines, keeping a fenced code block whole.
function blocksOf(markdown: string): string[][] {
  const lines = markdown.split(/\r?\n/);
  const fenced = fencedLines(lines);
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (!fenced[index] && line.trim() === "") {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) {
    blocks.push(current);
  }
  return blocks;
}

/**
 * lastBlockOf is the last block of a speech, a paragraph or a list: a list whose items are apart
 * (a loose list), or whose item goes on in an indented paragraph, is one block.
 */
export function lastBlockOf(markdown: string): string {
  const merged: string[][] = [];
  for (const block of blocksOf(markdown)) {
    const previous = merged.at(-1);
    const first = block[0] ?? "";
    if (
      previous !== undefined &&
      isListBlock(previous) &&
      (LIST_ITEM.test(first) || /^\s{2,}\S/.test(first))
    ) {
      previous.push("", ...block);
      continue;
    }
    merged.push([...block]);
  }
  return (merged.at(-1) ?? []).join("\n").trim();
}

// plainOf is an option without the marks of Markdown: a link reads as its text, and bold and code
// lose their marks.
function plainOf(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// shortOf is the start of an option that fits a quick reply: whole, or cut at a word with "…".
function shortOf(text: string): string {
  const plain = plainOf(text);
  if (plain.length <= QUICK_REPLY_MAX) {
    return plain;
  }
  const head = plain.slice(0, QUICK_REPLY_MAX - 1);
  const space = head.lastIndexOf(" ");
  const cut = (space > 0 ? head.slice(0, space) : head).replace(/[\s,;:.!?–—-]+$/, "");
  return `${cut}…`;
}

// optionsOf are the options of a block labelled by a pattern, in order from a) or 1.; empty when
// the labels don't run on from the first one.
function optionsOf(lines: readonly string[], pattern: RegExp, first: string): QuickReply[] {
  const options: QuickReply[] = [];
  for (const line of lines) {
    const match = pattern.exec(line);
    if (match === null) {
      continue;
    }
    const [, key = "", text = ""] = match;
    const expected = String.fromCharCode(first.charCodeAt(0) + options.length);
    if (key.toLowerCase() !== expected) {
      return [];
    }
    options.push({ key, text: shortOf(text) });
  }
  return options;
}

/**
 * quickRepliesOf are the quick replies of the last block of a speech: its options labelled a)–h)
 * (or A), (a), **a)**) or numbered 1.–8., when there are 2 to 6 of them; empty otherwise.
 */
export function quickRepliesOf(lastBlock: string): QuickReply[] {
  // The lines of a fenced code block are code, never options.
  const all = lastBlock.split(/\r?\n/);
  const fenced = fencedLines(all);
  const lines = all.filter((_, index) => !fenced[index]);
  const letters = optionsOf(lines, LETTER_OPTION, "a");
  const options = letters.length > 0 ? letters : optionsOf(lines, NUMBER_OPTION, "1");
  return options.length >= MIN_REPLIES && options.length <= MAX_REPLIES ? options : [];
}

// isComplete reports whether every question has a choice.
function isComplete(questions: readonly Question[], choices: QuestionChoices): boolean {
  return questions.every((_, index) => hasChoice(choices[index]));
}

// answeredIndex is the question a text from the composer answers: the one whose Other… waits for
// its text, else the first one without a choice, else the first one.
function answeredIndex(questions: readonly Question[], choices: QuestionChoices): number {
  const waiting = questions.findIndex((_, index) => {
    const other = choices[index]?.other ?? null;
    return other !== null && other.trim() === "";
  });
  if (waiting >= 0) {
    return waiting;
  }
  const open = questions.findIndex((_, index) => !hasChoice(choices[index]));
  return open >= 0 ? open : 0;
}

/**
 * answerWithText puts the text as the Other of the first question without a choice (T26): the
 * question whose Other… waits for its text first, and with every question chosen, the first one.
 * In a multiSelect the text is one more choice; in a single choice it takes the place of the
 * option, as Other… does on the card. complete is every question having a choice.
 */
export function answerWithText(
  q: QuestionEntry,
  choices: QuestionChoices,
  text: string,
): { choices: QuestionChoices; complete: boolean } {
  const questions = q.questions ?? [];
  const answer = text.trim();
  if (answer === "" || questions.length === 0) {
    return { choices, complete: isComplete(questions, choices) };
  }
  const index = answeredIndex(questions, choices);
  const labels = questions[index]?.multiSelect ? (choices[index]?.labels ?? []) : [];
  const next: QuestionChoices = { ...choices, [index]: { labels, other: answer } };
  return { choices: next, complete: isComplete(questions, next) };
}

/**
 * answersOf is the payload of answerQuestion: by the text of each question, the labels picked and
 * the text of Other… joined by ", "; "" for a question without a choice.
 */
export function answersOf(q: QuestionEntry, choices: QuestionChoices): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const [index, item] of (q.questions ?? []).entries()) {
    const choice = choices[index];
    const other = choice?.other?.trim() ?? "";
    answers[item.question] = [...(choice?.labels ?? []), ...(other === "" ? [] : [other])].join(
      ", ",
    );
  }
  return answers;
}

/**
 * sendIsPrimary reports whether Send is the primary: with text, and no other primary drawn on the
 * screen, enabled or dashed (Answer or Allow of a pending card, the primary of the bar, Approve draft).
 */
export function sendIsPrimary(text: string, otherPrimary: boolean): boolean {
  return text.trim() !== "" && !otherPrimary;
}

/**
 * Pending is what a conversation holds unanswered: its last question and its last permission still
 * pending, and which of the two came last.
 */
export interface Pending {
  question: QuestionEntry | null;
  permission: PermissionEntry | null;
  last: "question" | "permission" | null;
}

/** pendingOf is the question and the permission still unanswered in the entries of a conversation. */
export function pendingOf(entries: readonly Entry[]): Pending {
  const pending: Pending = { question: null, permission: null, last: null };
  for (const entry of entries) {
    if (entry.question != null && asPermissionStatus(entry.question.status) === "pending") {
      pending.question = entry.question;
      pending.last = "question";
    }
    if (entry.permission != null && asPermissionStatus(entry.permission.status) === "pending") {
      pending.permission = entry.permission;
      pending.last = "permission";
    }
  }
  return pending;
}

/** PendingCards are the cards a conversation holds pending: the question, and a permission. */
export interface PendingCards {
  question: QuestionEntry | null;
  permission: boolean;
}

/** pendingCardsOf are the question and the permission still unanswered in the entries of a conversation. */
export function pendingCardsOf(entries: readonly Entry[]): PendingCards {
  const { question, permission } = pendingOf(entries);
  return { question, permission: permission !== null };
}

/**
 * chipsOf are the quick replies of a conversation: the options of the last block of its last
 * complete speech, the agent's own and not a subagent's.
 */
export function chipsOf(entries: readonly Entry[]): QuickReply[] {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const speech = entries[index]?.assistant;
    if (speech?.complete === true && speech.parentToolUseId === "") {
      return quickRepliesOf(lastBlockOf(speech.text));
    }
  }
  return [];
}

/**
 * otherHeaderOf is the header of the question whose Other… waits for its text on the card, null
 * without one.
 */
export function otherHeaderOf(q: QuestionEntry | null, choices: QuestionChoices): string | null {
  const questions = q?.questions ?? [];
  const index = questions.findIndex((_, i) => choices[i]?.other === "");
  return index < 0 ? null : (questions[index]?.header ?? null);
}
