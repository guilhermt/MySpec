import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QuestionChoices } from "@/features/chat/composer";
import { cn } from "@/lib/utils";
import { asPermissionStatus, type Question, type QuestionEntry } from "@/lib/wails";
import { answerQuestion } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

const OTHER_LABEL = "Other…";

const OPTION_CLASS =
  "flex cursor-pointer flex-col gap-0.5 rounded-md border p-2 transition-colors hover:bg-accent/50 has-checked:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50";

/** Choice is what the user picked for one question, before it is sent. */
interface Choice {
  labels: string[];
  other: boolean;
  otherText: string;
}

const NO_CHOICE: Choice = { labels: [], other: false, otherText: "" };

const NO_CHOICES: QuestionChoices = {};

// choiceOf reads the choice kept in the store, where the composer answers too: other is null
// without Other….
function choiceOf(kept: QuestionChoices[number] | undefined): Choice {
  if (kept === undefined) {
    return NO_CHOICE;
  }
  return { labels: kept.labels, other: kept.other !== null, otherText: kept.other ?? "" };
}

function toggle(labels: readonly string[], label: string): string[] {
  return labels.includes(label)
    ? labels.filter((current) => current !== label)
    : [...labels, label];
}

function isComplete(choice: Choice): boolean {
  return choice.other ? choice.otherText.trim() !== "" : choice.labels.length > 0;
}

// The agent reads one line per question, so what was typed under "Other" joins
// the picked labels the same way several labels join each other.
function answerOf(choice: Choice): string {
  const parts = choice.other ? [...choice.labels, choice.otherText.trim()] : choice.labels;
  return parts.join(", ");
}

export interface QuestionCardProps {
  taskId: string;
  stage: string;
  question: QuestionEntry;
  /** readOnly is the card of an earlier conversation: the questions and their options as text, and the answers when there were. */
  readOnly?: boolean;
}

/**
 * QuestionCard is the agent asking the user to decide. Every question has to be
 * answered before the turn goes on.
 */
export function QuestionCard({ taskId, stage, question, readOnly = false }: QuestionCardProps) {
  const titleId = useId();
  const groupName = useId();
  const questions = question.questions ?? [];
  const choices = useAppStore((state) => state.questionChoices[question.requestId] ?? NO_CHOICES);
  const setQuestionChoices = useAppStore((state) => state.setQuestionChoices);
  const setChoice = (index: number, choice: Choice) =>
    setQuestionChoices(question.requestId, {
      ...choices,
      [index]: { labels: choice.labels, other: choice.other ? choice.otherText : null },
    });

  const status = asPermissionStatus(question.status);
  const pending = status === "pending";
  // An earlier conversation takes no answer: its card has no controls.
  const answerable = pending && !readOnly;
  const answered = question.answers ?? {};

  const choiceAt = (index: number): Choice => choiceOf(choices[index]);
  const complete = questions.every((_, index) => isComplete(choiceAt(index)));

  const send = () => {
    const answers: Record<string, string> = {};
    for (const [index, item] of questions.entries()) {
      answers[item.question] = answerOf(choiceAt(index));
    }
    void answerQuestion(taskId, stage, question.requestId, answers);
  };

  return (
    <fieldset
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-lg border border-l-4 border-l-[var(--status-attention-fill)] bg-card p-4",
        !pending && "opacity-80",
      )}
    >
      <span id={titleId} className="font-medium">
        A question for you
      </span>

      {readOnly ? (
        questions.map((item) => (
          <QuestionText
            key={item.question}
            question={item}
            answer={answered[item.question] ?? ""}
          />
        ))
      ) : pending ? (
        questions.map((item, index) => (
          <QuestionField
            key={item.question}
            name={`${groupName}-${index}`}
            question={item}
            choice={choiceAt(index)}
            onChange={(choice) => setChoice(index, choice)}
          />
        ))
      ) : (
        <ul className="flex flex-col gap-1">
          {questions.map((item) => (
            <li key={item.question} className="select-text">
              {item.header}: {answered[item.question] ?? ""}
            </li>
          ))}
        </ul>
      )}

      {status === "cancelled" && (
        <p className="text-xs text-muted-foreground">Cancelled before an answer</p>
      )}

      {answerable && (
        <div>
          <Button disabled={!complete} onClick={send}>
            Answer
          </Button>
        </div>
      )}
    </fieldset>
  );
}

interface QuestionTextProps {
  question: Question;
  /** answer is what was answered to the question, "" when nothing was. */
  answer: string;
}

/** QuestionText is a question read after the fact: what was asked, the options offered, and the answer. */
function QuestionText({ question, answer }: QuestionTextProps) {
  return (
    <div className="flex flex-col gap-2 select-text">
      <div className="flex flex-col gap-1">
        <Badge variant="secondary" className="self-start">
          {question.header}
        </Badge>
        <p className="font-medium">{question.question}</p>
      </div>
      <ul className="flex flex-col gap-1">
        {(question.options ?? []).map((option) => (
          <li key={option.label}>
            {option.label}
            {option.description !== "" && (
              <span className="text-xs text-muted-foreground">{` · ${option.description}`}</span>
            )}
          </li>
        ))}
      </ul>
      {/* The answer reads as it does on a card answered in the conversation of the place. */}
      {answer !== "" && <p>{`${question.header}: ${answer}`}</p>}
    </div>
  );
}

interface QuestionFieldProps {
  /** name groups the radios of this question, so only one of them stays picked. */
  name: string;
  question: Question;
  choice: Choice;
  onChange: (choice: Choice) => void;
}

function QuestionField({ name, question, choice, onChange }: QuestionFieldProps) {
  const options = question.options ?? [];

  const pick = (label: string) => {
    if (question.multiSelect) {
      onChange({ ...choice, labels: toggle(choice.labels, label) });
      return;
    }
    onChange({ labels: [label], other: false, otherText: "" });
  };

  const pickOther = () => {
    if (question.multiSelect) {
      onChange({ ...choice, other: !choice.other });
      return;
    }
    onChange({ labels: [], other: true, otherText: choice.otherText });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Badge variant="secondary" className="self-start">
          {question.header}
        </Badge>
        <p className="font-medium select-text">{question.question}</p>
      </div>

      <fieldset aria-label={question.question} className="flex min-w-0 flex-col gap-1.5">
        {options.map((option) => (
          <label key={option.label} className={OPTION_CLASS}>
            <span className="flex items-center gap-2">
              <input
                type={question.multiSelect ? "checkbox" : "radio"}
                name={name}
                className="sr-only"
                checked={choice.labels.includes(option.label)}
                onChange={() => pick(option.label)}
              />
              {option.label}
            </span>
            {option.description !== "" && (
              <span className="text-xs text-muted-foreground">{option.description}</span>
            )}
          </label>
        ))}
        <label className={OPTION_CLASS}>
          <span className="flex items-center gap-2">
            <input
              type={question.multiSelect ? "checkbox" : "radio"}
              name={name}
              className="sr-only"
              checked={choice.other}
              onChange={pickOther}
            />
            {OTHER_LABEL}
          </span>
        </label>
      </fieldset>

      {choice.other && (
        <Input
          autoFocus
          aria-label={`Other answer for ${question.header}`}
          placeholder="Your answer"
          value={choice.otherText}
          onChange={(event) => onChange({ ...choice, otherText: event.target.value })}
        />
      )}
    </div>
  );
}
