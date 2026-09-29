import { type KeyboardEvent, useState } from "react";
import { Button } from "@/components/system/Button";
import { Spinner } from "@/components/system/Spinner";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { formatDuration } from "@/features/chat/actions";
import { COLUMN_CLASS } from "@/features/chat/ConversationColumn";
import {
  answersOf,
  answerWithText,
  type ComposerContext,
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
import { focusRequest } from "@/features/task/request-focus";
import { cn } from "@/lib/utils";
import { asSessionStatus, type QuestionEntry } from "@/lib/wails";
import {
  answerQuestion,
  interrupt,
  resume,
  sendMessageInPlace,
  setSessionModel,
} from "@/store/actions";
import { useAppStore, useDraft } from "@/store/app-store";

const NO_CHOICES: QuestionChoices = {};
const NO_CHIPS: QuickReply[] = [];

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
  context: Pick<ComposerContext, "findings" | "askForChange">;
}

/** Working is the turn running: the spinner and the time since it started. */
function Working({ startedAt }: { startedAt: string }) {
  const start = startedAt === "" ? Number.NaN : Date.parse(startedAt);
  const now = useNow(SECOND, !Number.isNaN(start));
  return (
    <span className="flex items-center gap-1.5 text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
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
  context,
}: ComposerProps) {
  const draft = useDraft(taskId, stage);
  const setDraft = useAppStore((state) => state.setDraft);
  const choices = useAppStore((state) =>
    question === null ? NO_CHOICES : (state.questionChoices[question.requestId] ?? NO_CHOICES),
  );
  const setQuestionChoices = useAppStore((state) => state.setQuestionChoices);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [stopping, setStopping] = useState(false);
  const [saving, setSaving] = useState(false);

  const who = voiceInSentence(voiceOf(stage)) || "agent";
  const paused = asSessionStatus(session.sessionStatus) === "paused";
  const turnRunning = session.turnRunning;
  const empty = draft.trim() === "";
  const placeholder = placeholderOf({
    who,
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
  });

  // deliver sends a text as a message, resuming a paused session first; the text of the field
  // stays until it is sent.
  const deliver = async (text: string, clears: boolean) => {
    setSending(true);
    setError("");
    if (paused) {
      await resume(taskId, stage);
    }
    const failure = await sendMessageInPlace(taskId, stage, text);
    setSending(false);
    setError(failure);
    if (failure === "" && clears) {
      setDraft(taskId, stage, "");
    }
  };

  // answer puts the text of the field on the pending question, and sends the card once every
  // question has a choice; otherwise the focus goes back to the card.
  const answer = (q: QuestionEntry, text: string) => {
    const next = answerWithText(q, choices, text);
    setQuestionChoices(q.requestId, next.choices);
    setDraft(taskId, stage, "");
    if (next.complete) {
      void answerQuestion(taskId, stage, q.requestId, answersOf(q, next.choices));
      return;
    }
    focusRequest("question");
  };

  const send = () => {
    if (sending) {
      return;
    }
    const text = draft.trim();
    if (question !== null) {
      if (text !== "" || answerWithText(question, choices, "").complete) {
        answer(question, text);
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
      {...(empty ? { disabled: true, disabledReason: "Write a message" } : {})}
      loading={sending}
      loadingLabel="Sending…"
      onClick={send}
    >
      {sendLabel}
    </Button>
  );

  return (
    <div className="shrink-0 px-(--space-6) pt-(--space-2) pb-(--space-4)">
      <div
        className={cn(
          COLUMN_CLASS,
          "flex flex-col rounded-lg border border-line-3 bg-surface-input shadow-xs transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard has-[textarea:focus-visible]:field-focus!",
        )}
      >
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2">
            {chips.map((chip) => (
              <Tooltip key={chip.key} content={`Sends “${chip.key}”`}>
                <Button size="xs" disabled={sending} onClick={() => void deliver(chip.key, false)}>
                  <span className="font-mono">{chip.key}</span>
                  {` · ${chip.text}`}
                </Button>
              </Tooltip>
            ))}
          </div>
        )}
        <textarea
          id="composer-input"
          aria-label={composerLabelOf(who)}
          value={draft}
          onChange={(event) => setDraft(taskId, stage, event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="field-sizing-content max-h-(--size-composer-max) min-h-(--size-composer-min) resize-none overflow-y-auto bg-transparent px-3 py-2 text-(length:--text-body) leading-(--leading-body) text-ink-1 outline-none placeholder:text-ink-4"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex min-w-0 items-center gap-2">
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
            <div className="flex items-center gap-2">
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
            sendButton
          )}
        </div>
      </div>
    </div>
  );
}
