import { Ban } from "lucide-react";
import { Markdown } from "@/features/chat/Markdown";
import type { AssistantEntry } from "@/lib/wails";

export interface AssistantMessageProps {
  assistant: AssistantEntry;
}

/** AssistantMessage is one block of what the agent wrote, as Markdown. */
export function AssistantMessage({ assistant }: AssistantMessageProps) {
  return (
    <div className="select-text">
      <Markdown streaming={!assistant.complete}>{assistant.text}</Markdown>
      {assistant.interrupted && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Ban className="size-3" />
          Interrupted
        </p>
      )}
    </div>
  );
}
