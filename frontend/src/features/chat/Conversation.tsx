import { useMemo, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityIndicator } from "@/features/chat/ActivityIndicator";
import { ActionGroup } from "@/features/chat/entries/ActionGroup";
import { AppMessage } from "@/features/chat/entries/AppMessage";
import { AssistantMessage } from "@/features/chat/entries/AssistantMessage";
import { ErrorCard } from "@/features/chat/entries/ErrorCard";
import { Marker } from "@/features/chat/entries/Marker";
import { PendingMessage } from "@/features/chat/entries/PendingMessage";
import { PermissionCard } from "@/features/chat/entries/PermissionCard";
import { QuestionCard } from "@/features/chat/entries/QuestionCard";
import { UserMessage } from "@/features/chat/entries/UserMessage";
import { groupEntries } from "@/features/chat/group";
import { NewMessagesPill } from "@/features/chat/NewMessagesPill";
import type { SessionState } from "@/features/chat/session";
import { useAutoScroll } from "@/features/chat/useAutoScroll";
import type { Entry } from "@/lib/wails";
import { useTranscript } from "@/store/app-store";

const NO_ENTRIES: readonly Entry[] = [];

const LOADING_WIDTHS = ["w-3/4", "w-full", "w-1/2"];

function Loading() {
  return (
    <div className="flex flex-col gap-3">
      {LOADING_WIDTHS.map((width) => (
        <Skeleton key={width} className={`h-4 ${width}`} />
      ))}
    </div>
  );
}

function EntryBlock({ taskId, stage, entry }: { taskId: string; stage: string; entry: Entry }) {
  if (entry.user !== null) {
    // The stage prompt is the agent's instructions, not a line of the
    // conversation: only what the app says on top of it is worth showing.
    if (entry.user.prompt && entry.user.text === "") {
      return null;
    }
    return entry.user.app ? <AppMessage user={entry.user} /> : <UserMessage user={entry.user} />;
  }
  if (entry.assistant !== null) {
    return <AssistantMessage assistant={entry.assistant} />;
  }
  if (entry.action !== null) {
    return <ActionGroup actions={[entry.action]} />;
  }
  if (entry.permission !== null) {
    return <PermissionCard taskId={taskId} stage={stage} permission={entry.permission} />;
  }
  if (entry.question !== null) {
    return <QuestionCard taskId={taskId} stage={stage} question={entry.question} />;
  }
  if (entry.marker !== null) {
    return <Marker marker={entry.marker} createdAt={entry.createdAt} />;
  }
  if (entry.error !== null) {
    return <ErrorCard taskId={taskId} stage={stage} error={entry.error} />;
  }
  return null;
}

export interface ConversationProps {
  taskId: string;
  /** stage names the session on screen: a task stage, step:<n> or pr:<slug>. */
  stage: string;
  /** session is the one that stage names, whose work the indicator shows. */
  session: SessionState;
}

/** Conversation is everything that was said and done, from the top down. */
export function Conversation({ taskId, stage, session }: ConversationProps) {
  const transcript = useTranscript(taskId, stage);
  const scrollRef = useRef<HTMLDivElement>(null);

  const entries = transcript?.entries ?? NO_ENTRIES;
  const pending = transcript?.pending ?? NO_ENTRIES;
  // The text of the last entry is what grows while the agent writes.
  const streaming = entries.at(-1)?.assistant?.text ?? "";
  const { hasNew, scrollToBottom } = useAutoScroll(scrollRef, [
    entries.length,
    pending.length,
    streaming,
  ]);
  const items = useMemo(() => groupEntries(entries), [entries]);
  const loading = transcript === null || transcript.status === "loading";

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} data-slot="conversation" className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-6 py-6">
          {loading ? (
            <Loading />
          ) : (
            <>
              {items.map((item) =>
                item.kind === "actions" ? (
                  <ActionGroup key={item.key} actions={item.items} />
                ) : (
                  <EntryBlock key={item.key} taskId={taskId} stage={stage} entry={item.entry} />
                ),
              )}
              {pending.map(
                (entry) =>
                  entry.user !== null && (
                    <PendingMessage
                      key={entry.id}
                      taskId={taskId}
                      stage={stage}
                      entryId={entry.id}
                      user={entry.user}
                    />
                  ),
              )}
              <ActivityIndicator session={session} entries={entries} />
            </>
          )}
        </div>
      </div>
      {hasNew && <NewMessagesPill onClick={scrollToBottom} />}
    </div>
  );
}
