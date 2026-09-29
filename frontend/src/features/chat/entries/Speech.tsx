import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { Markdown } from "@/features/chat/Markdown";
import { type AssistantEntry, asInterruptedBy } from "@/lib/wails";
import { clockTime } from "@/lib/when";

export interface SpeechProps {
  assistant: AssistantEntry;
  createdAt: string;
  /** voice is the word of who talks, always in the name. */
  voice: string;
  /** voiceShown writes the word, where the voice changes; streaming writes it too. */
  voiceShown: boolean;
  /** railLast marks the last block with the rail of a question in text. */
  railLast?: boolean;
}

// interruption is the line under a speech cut short, "" when none is drawn: a crash says nothing,
// the error block after it does.
function interruption(assistant: AssistantEntry): string {
  switch (asInterruptedBy(assistant.interruptedBy)) {
    case "user":
      return "Interrupted by you";
    case "crash":
      return "";
    default:
      return assistant.interrupted ? "Interrupted" : "";
  }
}

/** Speech is what the agent said: the band of who talks and the Markdown. */
export function Speech({ assistant, createdAt, voice, voiceShown, railLast = false }: SpeechProps) {
  const streaming = !assistant.complete;
  const time = clockTime(createdAt, Date.now());
  const cut = interruption(assistant);
  const name = [
    `${voice}, ${time}`,
    streaming ? "writing" : "",
    cut === "Interrupted by you" ? "interrupted by you" : "",
  ]
    .filter((part) => part !== "")
    .join(", ");

  return (
    <article
      data-feed-item
      tabIndex={-1}
      aria-label={name}
      className="flex flex-col gap-(--space-1) outline-none focus-visible:focus-ring rounded-sm"
    >
      <div className="flex h-(--size-control-xs) items-center gap-(--space-1-5) text-(length:--text-meta) leading-(--leading-meta)">
        {streaming && <Spinner />}
        {(voiceShown || streaming) && <span className="font-medium text-ink-2">{voice}</span>}
        <span className="entry-time text-ink-4 tabular-nums">{time}</span>
      </div>
      <div className="select-text">
        <Markdown streaming={streaming} cutCode railLast={railLast}>
          {assistant.text}
        </Markdown>
      </div>
      {cut !== "" && (
        <p className="flex items-center gap-(--space-1) text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          <Icon icon={ICONS.ban} size="xs" />
          {cut}
        </p>
      )}
    </article>
  );
}
