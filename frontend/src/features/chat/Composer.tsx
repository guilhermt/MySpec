import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Chip } from "@/components/system/Chip";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { Tooltip } from "@/components/system/Tooltip";
import { useToastLift } from "@/components/system/toast-lift";
import { useNow } from "@/features/attention/useNow";
import { formatDuration } from "@/features/chat/actions";
import { COLUMN_CLASS } from "@/features/chat/ConversationColumn";
import {
  answersOf,
  answerWithText,
  type ComposerContext,
  type ComposerStarter,
  composerLabelOf,
  otherHeaderOf,
  placeholderOf,
  type QuestionChoices,
  type QuickReply,
  sendIsPrimary,
} from "@/features/chat/composer";
import { voiceInSentence, voiceOf } from "@/features/chat/markers";
import type { SessionState } from "@/features/chat/session";
import { ModelChip } from "@/features/models/ModelChip";
import { focusRequest } from "@/lib/focus";
import { cn } from "@/lib/utils";
import { asSessionStatus, type QuestionEntry } from "@/lib/wails";
import {
  answerQuestionInPlace,
  interrupt,
  resumeInPlace,
  sendMessageInPlace,
  setSessionModel,
} from "@/store/actions";
import { useAppStore, useDraft } from "@/store/app-store";

const NO_CHOICES: QuestionChoices = {};
const NO_CHIPS: QuickReply[] = [];
const NO_STARTERS: readonly ComposerStarter[] = [];

// EMPTY_REASON is why Send is disabled with nothing written, in its tooltip and its description.
const EMPTY_REASON = "Write a message";

// SECOND is how often the time of the running turn is read again.
const SECOND = 1000;

export interface ComposerProps {
  taskId: string;
  /** stage names the session the message goes to. */
  stage: string;
  /** session is the one being written to, which need not be the task's. */
  session: SessionState;
  /** question is the question the conversation holds pending, which a text answers (T26). */
  question?: QuestionEntry | null;
  /** permissionPending is a permission the conversation holds pending. */
  permissionPending?: boolean;
  /** otherPrimary is another primary on screen: the bar's, enabled or dashed, or a pending card's. */
  otherPrimary: boolean;
  /** chips are the quick replies of the question in text of the reply situation. */
  chips?: QuickReply[];
  /** starters are the chips that start the message: Ask for changes, Ask to fix the drafts. */
  starters?: readonly ComposerStarter[];
  /** context is what the placeholder needs; its who, when given, wins over the voice of the stage. */
  context: Pick<
    ComposerContext,
    "findings" | "askForChange" | "reviseFindings" | "item" | "drafts"
  > & { who?: string };
}

/** Working is the turn running: the spinner and the time since it started. */
function Working({ startedAt }: { startedAt: string }) {
  const start = startedAt === "" ? Number.NaN : Date.parse(startedAt);
  const now = useNow(SECOND, !Number.isNaN(start));
  return (
    <span className="flex items-center gap-(--space-1-5) text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
      <Spinner />
      {Number.isNaN(start) ? "Working" : `Working · ${formatDuration(Math.max(now - start, 0))}`}
    </span>
  );
}

/**
 * Composer is where the user answers. It stays open while the agent works: the message waits in the
 * queue instead of the user waiting for a free field. Sending resumes a paused task, and with a
 * question pending the text answers it.
 */
export function Composer({
  taskId,
  stage,
  session,
  question = null,
  permissionPending = false,
  otherPrimary,
  chips = NO_CHIPS,
  starters = NO_STARTERS,
  context,
}: ComposerProps) {
  const draft = useDraft(taskId, stage);
  const setDraft = useAppStore((state) => state.setDraft);
  const choices = useAppStore((state) =>
    question === null ? NO_CHOICES : (state.questionChoices[question.requestId] ?? NO_CHOICES),
  );
  const setQuestionChoices = useAppStore((state) => state.setQuestionChoices);
  // answerSending is the question's answer on its way, from the card or from here.
  const answerSending = useAppStore(
    (state) => question !== null && state.questionSending[question.requestId] === true,
  );
  const emptyReasonId = useId();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [stopping, setStopping] = useState(false);
  const [saving, setSaving] = useState(false);
  // backToCard counts the texts that left the card incomplete: after each one is drawn on the card,
  // the focus goes to its first question without a choice.
  const [backToCard, setBackToCard] = useState(0);
  const field = useRef<HTMLTextAreaElement>(null);
  // The box is docked at the foot of the main area: the toasts rise above it.
  const box = useRef<HTMLDivElement>(null);
  useToastLift(box);
  // atEnd counts the starters put in the box: after each one is drawn, the cursor goes to the end.
  const [atEnd, setAtEnd] = useState(0);
  const requestId = question?.requestId;

  // A failure belongs to the question it was told for: the card sending the answer, or the question
  // settling, leaves it behind, so it doesn't outlive the answer that went through the other side.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the failure is cleared when the question changes.
  useEffect(() => {
    setError("");
  }, [requestId]);
  useEffect(() => {
    if (answerSending) {
      setError("");
    }
  }, [answerSending]);

  useEffect(() => {
    if (backToCard > 0) {
      focusRequest("question");
    }
  }, [backToCard]);

  useEffect(() => {
    if (atEnd === 0 || field.current === null) {
      return;
    }
    const length = field.current.value.length;
    field.current.focus();
    field.current.setSelectionRange(length, length);
  }, [atEnd]);

  const who = context.who ?? (voiceInSentence(voiceOf(stage)) || "agent");
  const paused = asSessionStatus(session.sessionStatus) === "paused";
  const turnRunning = session.turnRunning;
  const empty = draft.trim() === "";
  const placeholder = placeholderOf({
    paused,
    stopped: session.lastError !== "",
    turnFailed: session.turnFailed,
    turnRunning,
    question,
    choices: question === null ? null : choices,
    otherHeader: otherHeaderOf(question, choices),
    permission: permissionPending,
    chips,
    ...context,
    who,
  });

  // deliver sends a text as a message, resuming a paused session first, and stops there when it
  // doesn't resume; the text of the field stays until it is sent.
  const deliver = async (text: string, clears: boolean) => {
    setSending(true);
    setError("");
    const failure =
      (paused ? await resumeInPlace(taskId, stage) : "") ||
      (await sendMessageInPlace(taskId, stage, text));
    setSending(false);
    setError(failure);
    if (failure === "" && clears) {
      setDraft(taskId, stage, "");
    }
  };

  // answer puts the text of the field on the pending question, and sends the card once every
  // question has a choice; otherwise the text leaves the field and the focus goes back to the card.
  // Sending, the text stays in the field until the answer is sent: not sent, it leaves the card
  // again, so Send again puts it back where it was.
  const answer = async (q: QuestionEntry, text: string) => {
    const next = answerWithText(q, choices, text);
    setQuestionChoices(q.requestId, next.choices);
    if (!next.complete) {
      setDraft(taskId, stage, "");
      setBackToCard((count) => count + 1);
      return;
    }
    setSending(true);
    setError("");
    const failure = await answerQuestionInPlace(
      taskId,
      stage,
      q.requestId,
      answersOf(q, next.choices),
    );
    setSending(false);
    setError(failure);
    if (failure === "") {
      setDraft(taskId, stage, "");
    } else if (useAppStore.getState().questionChoices[q.requestId] === next.choices) {
      // Back to what the card held, unless the question settled while the answer was on its way.
      setQuestionChoices(q.requestId, choices);
    }
  };

  // start puts the start of a message at the beginning of the box, unless it is there already.
  const start = (starter: ComposerStarter) => {
    if (!draft.startsWith(starter.text)) {
      setDraft(taskId, stage, starter.text + draft);
    }
    setAtEnd((count) => count + 1);
  };

  const send = () => {
    if (sending || answerSending) {
      return;
    }
    const text = draft.trim();
    if (question !== null) {
      if (text !== "" || answerWithText(question, choices, "").complete) {
        void answer(question, text);
      }
      return;
    }
    if (text !== "") {
      void deliver(text, true);
    }
  };

  const stop = async () => {
    setStopping(true);
    await interrupt(taskId, stage);
    setStopping(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
      return;
    }
    // Esc stops the turn only with nothing written: with text it leaves the field as it is.
    if (event.key === "Escape" && turnRunning && empty) {
      event.preventDefault();
      void stop();
    }
  };

  const changeModel = async (choice: { model: string; effort: string }) => {
    setSaving(true);
    await setSessionModel(taskId, stage, choice);
    setSaving(false);
  };

  const sendLabel = error === "" ? "Send" : "Send again";
  const sendButton = (
    <Button
      size="sm"
      variant={!turnRunning && sendIsPrimary(draft, otherPrimary) ? "primary" : "secondary"}
      {...(turnRunning ? {} : { shortcut: "↵" })}
      {...(empty ? { disabled: true, reasonId: emptyReasonId } : {})}
      loading={sending || answerSending}
      loadingLabel="Sending…"
      onClick={send}
    >
      {sendLabel}
    </Button>
  );
  // With the box empty, Send is dashed and says why in its tooltip, never beside it.
  const sendControl = empty ? (
    <>
      <Tooltip content={EMPTY_REASON}>{sendButton}</Tooltip>
      <span id={emptyReasonId} className="sr-only">
        {EMPTY_REASON}
      </span>
    </>
  ) : (
    sendButton
  );

  return (
    <div className="shrink-0 px-(--space-6) pt-(--space-2) pb-(--space-4)">
      <div
        ref={box}
        data-slot="composer"
        className={cn(
          COLUMN_CLASS,
          "flex flex-col rounded-lg border border-line-3 bg-surface-input shadow-xs transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard has-[textarea:focus-visible]:field-focus!",
        )}
      >
        {(starters.length > 0 || chips.length > 0) && (
          <div className="flex min-w-0 flex-wrap items-center gap-(--space-1-5) px-(--space-3) pt-(--space-2)">
            {starters.length > 0 && (
              <fieldset
                aria-label="Starts of a message"
                className="flex min-w-0 flex-wrap items-center gap-(--space-1-5)"
              >
                {starters.map((starter) => (
                  <Tooltip key={starter.label} content={starter.tooltip}>
                    <Chip
                      kind="action"
                      className="h-(--size-control-xs) gap-(--space-1-5) px-(--space-2)"
                      onClick={() => start(starter)}
                    >
                      <Icon icon={ICONS.revised} size="sm" tone="muted" />
                      {starter.label}
                    </Chip>
                  </Tooltip>
                ))}
              </fieldset>
            )}
            {chips.length > 0 && (
              <fieldset
                aria-label="Quick replies"
                className="flex min-w-0 flex-wrap items-center gap-(--space-1-5)"
              >
                {chips.map((chip) => (
                  <Tooltip key={chip.key} content={`Sends “${chip.key}”`}>
                    <Chip
                      kind="action"
                      aria-label={`${chip.key} · ${chip.text}`}
                      className="h-(--size-control-xs) gap-(--space-1-5) px-(--space-2)"
                      disabled={sending}
                      onClick={() => void deliver(chip.key, false)}
                    >
                      <span className="font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
                        {chip.key}
                      </span>
                      {chip.text}
                    </Chip>
                  </Tooltip>
                ))}
              </fieldset>
            )}
          </div>
        )}
        <textarea
          ref={field}
          id="composer-input"
          aria-label={composerLabelOf(who)}
          value={draft}
          onChange={(event) => setDraft(taskId, stage, event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="field-sizing-content max-h-(--size-composer-max) min-h-(--size-composer-min) resize-none overflow-y-auto bg-transparent px-(--space-3) py-(--space-2) text-(length:--text-body) leading-(--leading-body) text-ink-1 outline-none placeholder:text-ink-4"
        />
        <div className="flex items-center justify-between gap-(--space-2) px-(--space-2) pb-(--space-2)">
          <div className="flex min-w-0 items-center gap-(--space-2)">
            {session.sessionModel !== "" && (
              <ModelChip
                value={{ model: session.sessionModel, effort: session.sessionEffort }}
                onChange={(choice) => void changeModel(choice)}
                label="Conversation"
                own
                followNote="Model of this conversation · from your next message"
                saving={saving}
              />
            )}
            {error !== "" && (
              <p className="text-(length:--text-meta) leading-(--leading-meta) text-state-error">
                {`Not sent · ${error}`}
              </p>
            )}
          </div>
          {turnRunning ? (
            <div className="flex items-center gap-(--space-2)">
              <Working startedAt={session.turnStartedAt} />
              {!empty && (
                <Tooltip content="Queues until the turn ends" shortcut="Enter">
                  {sendButton}
                </Tooltip>
              )}
              <Tooltip content="Stop the answer" shortcut="Esc">
                <Button
                  size="sm"
                  loading={stopping}
                  loadingLabel="Stopping…"
                  onClick={() => void stop()}
                >
                  Stop
                </Button>
              </Tooltip>
            </div>
          ) : (
            sendControl
          )}
        </div>
      </div>
    </div>
  );
}
