import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { Tooltip } from "@/components/system/Tooltip";
import { answersOf, type QuestionChoices } from "@/features/chat/composer";
import { cn } from "@/lib/utils";
import { asPermissionStatus, type Question, type QuestionEntry } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { answerQuestionInPlace } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

const NO_CHOICES: QuestionChoices = {};

/** COMPOSER is the field Other… hands the answer to. */
const COMPOSER = "#composer-input";

/** REQUEST_CARD is the card of a request: the one outlined block of the conversation. */
export const REQUEST_CARD =
  "flex min-w-0 flex-col gap-(--space-3) rounded-lg bg-surface-2 p-(--space-4) shadow-[var(--shadow-card),0_0_0_var(--border)_var(--state-wait-line)]";

/** ANSWERED_CARD is a request after its answer: flat, without the ring and the shadow. */
export const ANSWERED_CARD =
  "flex min-w-0 flex-col gap-(--space-1) rounded-lg bg-surface-0 px-(--space-3) py-(--space-2-5)";

/** ENTRY is the article a card stands in, the entry of the feed that holds it. */
export const ENTRY = "rounded-lg outline-none focus-visible:focus-ring";

const OPTION =
  "flex w-full items-start gap-(--space-3) rounded-md border border-line-2 bg-surface-2 px-(--space-3) py-(--space-2) text-left transition-[background-color,border-color] duration-(--duration-fast) ease-standard outline-none not-aria-disabled:hover:border-line-3 not-aria-disabled:hover:bg-surface-2-hover focus-visible:focus-ring aria-checked:border-brand-ring aria-checked:bg-brand-tint aria-disabled:cursor-not-allowed";

const KEY =
  "inline-grid h-(--key-size) min-w-(--key-size) flex-none place-items-center rounded-xs border border-line-2 border-b-(length:--border-2) bg-surface-2 font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-2 group-aria-checked:border-brand-ring group-aria-checked:text-brand-ink";

function hasChoice(choice: QuestionChoices[number] | undefined): boolean {
  return (
    choice !== undefined &&
    (choice.labels.length > 0 || (choice.other !== null && choice.other.trim() !== ""))
  );
}

// chosen is the choice of a question after the option at index is picked: the options run over
// its own and Other…, the last one. A single choice takes one; a multiSelect toggles.
function chosen(
  question: Question,
  choice: QuestionChoices[number] | undefined,
  index: number,
): QuestionChoices[number] {
  const labels = choice?.labels ?? [];
  const other = choice?.other ?? null;
  const option = (question.options ?? [])[index];
  if (question.multiSelect) {
    if (option === undefined) {
      return { labels, other: other === null ? "" : null };
    }
    return {
      labels: labels.includes(option.label)
        ? labels.filter((label) => label !== option.label)
        : [...labels, option.label],
      other,
    };
  }
  return option === undefined
    ? { labels: [], other: other ?? "" }
    : { labels: [option.label], other: null };
}

// missingOf is why Answer waits: the one question without a choice, or how many are left.
function missingOf(questions: readonly Question[], choices: QuestionChoices): string | undefined {
  const left = questions.filter((_, index) => !hasChoice(choices[index])).length;
  if (left === 0) {
    return undefined;
  }
  return questions.length === 1
    ? "Choose an option"
    : `Answer ${left} more ${left === 1 ? "question" : "questions"}`;
}

export interface QuestionCardProps {
  taskId: string;
  stage: string;
  question: QuestionEntry;
  /** createdAt is when the agent asked. */
  createdAt: string;
  /** readOnly is the card of an earlier conversation: flat, with the answers when there were. */
  readOnly?: boolean;
  /** flash blinks the pending card that was born with the screen open. */
  flash?: boolean;
}

/**
 * QuestionCard is the agent asking the user to decide: pending, the options of each question and
 * Answer; answered or cancelled, a flat block with one line per question.
 */
export function QuestionCard({
  taskId,
  stage,
  question,
  createdAt,
  readOnly = false,
  flash = false,
}: QuestionCardProps) {
  const status = asPermissionStatus(question.status);
  if (status !== "pending" || readOnly) {
    return <AnsweredQuestion question={question} createdAt={createdAt} />;
  }
  return <PendingQuestion taskId={taskId} stage={stage} question={question} flash={flash} />;
}

function AnsweredQuestion({ question, createdAt }: { question: QuestionEntry; createdAt: string }) {
  const cancelled = asPermissionStatus(question.status) === "cancelled";
  const answers = question.answers ?? {};
  const tip =
    question.answeredAt === ""
      ? "Answered"
      : `Answered at ${clockTime(question.answeredAt, Date.now())}`;
  return (
    <article
      data-feed-item
      tabIndex={-1}
      aria-label={`Question, ${clockTime(createdAt, Date.now())}`}
      className={cn(ENTRY, ANSWERED_CARD)}
    >
      {(question.questions ?? []).map((item) => (
        <div key={item.question} className="flex flex-col gap-(--space-0-5) select-text">
          <div className="grid grid-cols-[var(--icon-sm)_minmax(0,1fr)] items-baseline gap-(--space-2)">
            {cancelled ? (
              <span />
            ) : (
              <Icon icon={ICONS.done} size="sm" className="self-center text-ink-3" />
            )}
            {cancelled ? (
              <span className="font-medium text-ink-1">{item.question}</span>
            ) : (
              <Tooltip content={tip}>
                <span className="font-medium text-ink-1">{item.question}</span>
              </Tooltip>
            )}
          </div>
          {!cancelled && (answers[item.question] ?? "") !== "" && (
            <p className="ml-[calc(var(--icon-sm)+var(--space-2))] text-ink-2">
              {answers[item.question]}
            </p>
          )}
        </div>
      ))}
      {cancelled && (
        <p className="ml-[calc(var(--icon-sm)+var(--space-2))] text-ink-3">
          Cancelled before an answer
        </p>
      )}
    </article>
  );
}

interface PendingQuestionProps {
  taskId: string;
  stage: string;
  question: QuestionEntry;
  flash: boolean;
}

function PendingQuestion({ taskId, stage, question, flash }: PendingQuestionProps) {
  const titleId = useId();
  const questions = question.questions ?? [];
  const choices = useAppStore((state) => state.questionChoices[question.requestId] ?? NO_CHOICES);
  const setQuestionChoices = useAppStore((state) => state.setQuestionChoices);
  // The answer on its way, sent from the card or from the composer, keeps its choices in the store
  // until the conversation turns the card into its answer.
  const sending = useAppStore((state) => state.questionSending[question.requestId] === true);
  const [failure, setFailure] = useState("");

  // A send that starts, from the composer or from here, leaves the failure of the last one behind.
  useEffect(() => {
    if (sending) {
      setFailure("");
    }
  }, [sending]);

  const missing = missingOf(questions, choices);
  const keys = (questions[0]?.options ?? []).length + 1;

  const pick = (at: number, index: number) => {
    const item = questions[at];
    if (item === undefined || sending) {
      return;
    }
    const next = chosen(item, choices[at], index);
    setQuestionChoices(question.requestId, { ...choices, [at]: next });
    // Other… is written in the composer, whose placeholder names the question.
    if (index === (item.options ?? []).length && next.other !== null) {
      document.querySelector<HTMLElement>(COMPOSER)?.focus();
    }
  };

  const send = async () => {
    if (missing !== undefined || sending) {
      return;
    }
    setFailure("");
    // Sent, the card turns into its answer when the conversation says so.
    setFailure(
      await answerQuestionInPlace(taskId, stage, question.requestId, answersOf(question, choices)),
    );
  };

  // The digits pick in the question whose group has the focus, else in the first without a
  // choice; the arrows go round the group; Enter sends once everything is chosen.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const target = event.target as HTMLElement;
    const group = target.closest<HTMLElement>("[data-question]");
    const at =
      group === null
        ? questions.findIndex((_, i) => !hasChoice(choices[i]))
        : Number(group.dataset.question);
    if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      const item = questions[at < 0 ? 0 : at];
      if (item !== undefined && index <= (item.options ?? []).length) {
        event.preventDefault();
        pick(at < 0 ? 0 : at, index);
      }
      return;
    }
    if (
      group !== null &&
      target.matches("[role=radio], [role=checkbox]") &&
      event.key.startsWith("Arrow")
    ) {
      const options = [...group.querySelectorAll<HTMLElement>("[role=radio], [role=checkbox]")];
      const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      const next = options[(options.indexOf(target) + step + options.length) % options.length];
      event.preventDefault();
      next?.focus();
      return;
    }
    if (event.key === "Enter" && (target === event.currentTarget || group !== null)) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <article
      data-feed-item
      data-pending-card="question"
      tabIndex={-1}
      aria-label={`Question, answer with 1 to ${keys}`}
      aria-busy={sending}
      {...(flash ? { "data-flash": "wait" } : {})}
      className={cn(ENTRY, "situation-flash")}
      onKeyDown={onKeyDown}
    >
      <fieldset aria-labelledby={titleId} className={REQUEST_CARD}>
        {questions.map((item, at) => (
          <QuestionGroup
            key={item.question}
            at={at}
            question={item}
            titleId={at === 0 ? titleId : undefined}
            choice={choices[at]}
            disabled={sending}
            onPick={(index) => pick(at, index)}
          />
        ))}
        <div className="flex flex-wrap items-center gap-(--space-2)">
          {!sending ? (
            <Button
              variant="primary"
              shortcut="↵"
              {...(missing !== undefined ? { disabled: true, disabledReason: missing } : {})}
              onClick={() => void send()}
            >
              Answer
            </Button>
          ) : (
            <p role="status" className="flex items-center gap-(--space-2) text-ink-2">
              <Spinner />
              {`Sending “${Object.values(answersOf(question, choices)).join(", ")}”…`}
            </p>
          )}
          {failure !== "" && !sending && (
            <p className="text-(length:--text-meta) leading-(--leading-meta) text-state-error">
              {`Not sent · ${failure}`}
            </p>
          )}
        </div>
      </fieldset>
    </article>
  );
}

interface QuestionGroupProps {
  at: number;
  question: Question;
  titleId: string | undefined;
  choice: QuestionChoices[number] | undefined;
  disabled: boolean;
  onPick: (index: number) => void;
}

function QuestionGroup({ at, question, titleId, choice, disabled, onPick }: QuestionGroupProps) {
  const ownId = useId();
  const id = titleId ?? ownId;
  const options = question.options ?? [];
  const role = question.multiSelect ? "checkbox" : "radio";
  const other = choice?.other ?? null;
  const checked = [
    ...options.map((option) => choice?.labels.includes(option.label) ?? false),
    other !== null,
  ];
  // One stop of Tab in a group of radios: the chosen option, else the first.
  const stop = question.multiSelect ? -1 : Math.max(checked.indexOf(true), 0);
  const rows = [
    ...options.map((option) => ({ title: option.label, note: option.description })),
    {
      title: other !== null && other.trim() !== "" ? `Other: ${other.trim()}` : "Other…",
      note: "Write your own answer.",
    },
  ];
  return (
    <div className="flex flex-col gap-(--space-2)">
      <span className="text-(length:--text-meta) leading-(--leading-meta) font-medium text-ink-3">
        {question.header}
      </span>
      <p
        id={id}
        className="text-(length:--text-title) leading-(--leading-title) font-semibold text-ink-1 select-text"
      >
        {question.question}
      </p>
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is radiogroup or group, both named by the question. */}
      <div
        role={question.multiSelect ? "group" : "radiogroup"}
        aria-labelledby={id}
        data-question={at}
        className="flex flex-col gap-(--space-1-5)"
      >
        {rows.map((row, index) => (
          // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is radio or checkbox, both checked; a button holds the key, the title and the trade-off
          <button
            key={row.title}
            type="button"
            role={role}
            aria-checked={checked[index] ?? false}
            aria-disabled={disabled || undefined}
            tabIndex={stop < 0 || stop === index ? 0 : -1}
            className={cn("group", OPTION)}
            onClick={() => onPick(index)}
          >
            <span className={KEY}>{index + 1}</span>
            <span className="flex flex-col gap-(--space-0-5) font-medium text-ink-1">
              {row.title}
              {row.note !== "" && (
                <small className="text-(length:--text-meta) leading-(--leading-meta) font-normal text-ink-3">
                  {row.note}
                </small>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
