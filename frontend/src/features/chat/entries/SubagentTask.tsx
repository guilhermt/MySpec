import { Markdown } from "@/features/chat/Markdown";
import { voiceInSentence } from "@/features/chat/markers";

export interface SubagentTaskProps {
  /** prompt is the task the subagent received. */
  prompt: string;
  /** voice is who gave it: the agent of the conversation the subagent came from. */
  voice: string;
}

/**
 * SubagentTask is the task a subagent received, as the first message of its conversation, in the
 * shape of the message of the user: the agent that delegated it is the author.
 */
export function SubagentTask({ prompt, voice }: SubagentTaskProps) {
  const author = `Task from the ${voiceInSentence(voice)}`;

  return (
    <article
      data-feed-item
      tabIndex={-1}
      aria-label={author}
      className="flex flex-col gap-(--space-1) rounded-lg bg-surface-user px-(--space-4) py-(--space-3) outline-none focus-visible:focus-ring"
    >
      <div className="text-(length:--text-meta) leading-(--leading-meta)">
        <span className="font-medium text-ink-2">{author}</span>
      </div>
      <div className="select-text">
        <Markdown cutCode>{prompt}</Markdown>
      </div>
    </article>
  );
}
