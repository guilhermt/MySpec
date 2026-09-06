import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { asPermissionStatus, type Question, type QuestionEntry } from "@/lib/wails";
import { answerQuestion } from "@/store/actions";

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
  question: QuestionEntry;
}

/**
 * QuestionCard is the agent asking the user to decide. Every question has to be
 * answered before the turn goes on.
 */
export function QuestionCard({ taskId, question }: QuestionCardProps) {
  const titleId = useId();
  const groupName = useId();
  const questions = question.questions ?? [];
  const [choices, setChoices] = useState<Record<number, Choice>>({});

  const status = asPermissionStatus(question.status);
  const pending = status === "pending";
  const answered = question.answers ?? {};

  const choiceAt = (index: number): Choice => choices[index] ?? NO_CHOICE;
  const complete = questions.every((_, index) => isComplete(choiceAt(index)));

  const send = () => {
    const answers: Record<string, string> = {};
    for (const [index, item] of questions.entries()) {
      answers[item.question] = answerOf(choiceAt(index));
    }
    void answerQuestion(taskId, question.requestId, answers);
  };

  return (
    <fieldset
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-lg border border-l-4 border-l-[var(--status-attention)] bg-card p-4",
        !pending && "opacity-80",
      )}
    >
      <span id={titleId} className="font-medium">
        A question for you
      </span>

      {pending ? (
        questions.map((item, index) => (
          <QuestionField
            key={item.question}
            name={`${groupName}-${index}`}
            question={item}
            choice={choiceAt(index)}
            onChange={(choice) => setChoices((current) => ({ ...current, [index]: choice }))}
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

      {pending && (
        <div>
          <Button disabled={!complete} onClick={send}>
            Answer
          </Button>
        </div>
      )}
    </fieldset>
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
