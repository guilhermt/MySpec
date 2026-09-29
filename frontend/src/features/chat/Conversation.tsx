import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { ConversationColumn } from "@/features/chat/ConversationColumn";
import { buildConversation, type Row } from "@/features/chat/conversation";
import { ActionGroup } from "@/features/chat/entries/ActionGroup";
import { Activity } from "@/features/chat/entries/Activity";
import { AppMessage } from "@/features/chat/entries/AppMessage";
import { BackToEnd } from "@/features/chat/entries/BackToEnd";
import { ErrorBlock } from "@/features/chat/entries/ErrorBlock";
import { Marker } from "@/features/chat/entries/Marker";
import { PermissionCard } from "@/features/chat/entries/PermissionCard";
import { QuestionCard } from "@/features/chat/entries/QuestionCard";
import { QueuedMessage } from "@/features/chat/entries/QueuedMessage";
import { Speech } from "@/features/chat/entries/Speech";
import { YourMessage } from "@/features/chat/entries/YourMessage";
import { voiceInSentence, voiceOf } from "@/features/chat/markers";
import type { SessionState } from "@/features/chat/session";
import { useAutoScroll } from "@/features/chat/useAutoScroll";
import { useFeed } from "@/features/chat/useFeed";
import type { Entry } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { useTranscript } from "@/store/app-store";

const NO_ENTRIES: readonly Entry[] = [];

const LOADING_WIDTHS = ["w-3/4", "w-full", "w-1/2"];

function Loading() {
  return (
    <Skeleton label="Loading the conversation">
      {LOADING_WIDTHS.map((width) => (
        <SkeletonBar key={width} className={width} />
      ))}
    </Skeleton>
  );
}

// Held is an entry of today's forms, held in an entry of the feed named by its time.
function Held({ createdAt, children }: { createdAt: string; children: ReactNode }) {
  return (
    <article
      data-feed-item
      tabIndex={-1}
      aria-label={clockTime(createdAt, Date.now())}
      className="rounded-sm outline-none focus-visible:focus-ring"
    >
      {children}
    </article>
  );
}

interface RowViewProps {
  taskId: string;
  stage: string;
  row: Row;
  voice: string;
  readOnly: boolean;
  /** railLast is the last speech, when it waits for a reply in text. */
  railLast: boolean;
}

function RowView({ taskId, stage, row, voice, readOnly, railLast }: RowViewProps) {
  switch (row.kind) {
    case "speech":
      return row.entry.assistant === null ? null : (
        <Speech
          assistant={row.entry.assistant}
          createdAt={row.entry.createdAt}
          voice={voice}
          voiceShown={row.voice !== null}
          railLast={railLast}
        />
      );
    case "user":
      return row.entry.user === null ? null : (
        <YourMessage user={row.entry.user} createdAt={row.entry.createdAt} />
      );
    case "start": {
      const prompt = row.prompt?.user ?? null;
      const createdAt = (row.marker ?? row.prompt)?.createdAt ?? "";
      return (
        <Held createdAt={createdAt}>
          <div className="flex flex-col gap-(--space-3)">
            {row.marker?.marker && (
              <Marker marker={row.marker.marker} createdAt={row.marker.createdAt} />
            )}
            {/* The stage prompt is the agent's instructions: only what the user gave with it shows. */}
            {prompt !== null && prompt.text !== "" && (
              <p className="text-(length:--text-body) leading-(--leading-body) break-words whitespace-pre-wrap text-ink-1 select-text">
                {prompt.text}
              </p>
            )}
          </div>
        </Held>
      );
    }
    case "product":
      return row.entry.user === null ? null : (
        <Held createdAt={row.entry.createdAt}>
          <AppMessage user={row.entry.user} />
        </Held>
      );
    case "marker":
      return row.entry.marker === null ? null : (
        <Held createdAt={row.entry.createdAt}>
          <Marker marker={row.entry.marker} createdAt={row.entry.createdAt} />
        </Held>
      );
    case "group":
      return (
        <Held createdAt={row.group.startedAt}>
          <ActionGroup
            actions={row.group.nodes.flatMap((node) => [
              node.action,
              ...node.children.map((child) => child.action),
            ])}
          />
        </Held>
      );
    case "question":
      return row.entry.question === null ? null : (
        <Held createdAt={row.entry.createdAt}>
          <QuestionCard
            taskId={taskId}
            stage={stage}
            question={row.entry.question}
            readOnly={readOnly}
          />
        </Held>
      );
    case "permission":
      return row.entry.permission === null ? null : (
        <Held createdAt={row.entry.createdAt}>
          <PermissionCard
            taskId={taskId}
            stage={stage}
            permission={row.entry.permission}
            readOnly={readOnly}
          />
        </Held>
      );
    case "error":
      return row.entry.error === null ? null : (
        <ErrorBlock error={row.entry.error} createdAt={row.entry.createdAt} />
      );
  }
}

// lastCompleteSpeech is the key of the last speech that is complete, "" without one.
function lastCompleteSpeech(rows: readonly Row[]): string {
  const speech = [...rows]
    .reverse()
    .find((row) => row.kind === "speech" && row.entry.assistant?.complete);
  return speech?.key ?? "";
}

export interface ConversationProps {
  taskId: string;
  /** stage names the session on screen: a task stage, step:<n> or pr:<slug>. */
  stage: string;
  /** session is the one that stage names, whose work the activity shows. */
  session: SessionState;
  /**
   * readOnly is an earlier conversation, which takes nothing more: no card answers, nothing
   * queued, no activity, and it opens at its start without following the end.
   */
  readOnly?: boolean;
  /** endLine is the derived line after the entries (Merged …, Closed …). */
  endLine?: ReactNode;
  /** fixed is the fixed card after the entries: changed files, the PR draft, the live checks. */
  fixed?: ReactNode;
  /** replyWaiting marks the last block of the last speech with the rail of a question in text (the reply situation). */
  replyWaiting?: boolean;
}

/** Conversation is everything that was said and done, from the top down, as a feed. */
export function Conversation({
  taskId,
  stage,
  session,
  readOnly = false,
  endLine,
  fixed,
  replyWaiting = false,
}: ConversationProps) {
  const transcript = useTranscript(taskId, stage);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);
  useFeed(feedRef);

  const entries = transcript?.entries ?? NO_ENTRIES;
  const pending = transcript?.pending ?? NO_ENTRIES;
  const voice = voiceOf(stage);
  const model = useMemo(() => buildConversation(entries, voice), [entries, voice]);
  const rows = useMemo(() => model.stretches.flatMap((stretch) => stretch.rows), [model]);
  const rowKeys = useMemo(() => rows.map((row) => row.key), [rows]);
  // The text of the last entry is what grows while the agent writes.
  const last = entries.at(-1);
  const streaming = last?.assistant ? !last.assistant.complete : false;
  const { atBottom, newCount, scrollToBottom } = useAutoScroll(
    viewportRef,
    contentRef,
    [entries.length, pending.length, last?.assistant?.text ?? ""],
    rowKeys,
    !readOnly,
  );
  // A reload keeps what is on screen, so the scroll has nothing to lose.
  const loading =
    transcript === null ||
    (transcript.status === "loading" && entries.length === 0 && pending.length === 0);
  const railKey = replyWaiting ? lastCompleteSpeech(rows) : "";

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    const onScroll = () => setAtTop(viewport.scrollTop <= 0);
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-0 flex-1">
      <ConversationColumn viewportRef={viewportRef} contentRef={contentRef} fadeTop={!atTop}>
        <div
          ref={feedRef}
          role="feed"
          aria-label={`Conversation with the ${voiceInSentence(voice)}`}
          aria-busy={streaming}
          className="flex flex-col gap-(--space-3)"
        >
          {loading ? (
            <Loading />
          ) : (
            <>
              {rows.map((row) => (
                <RowView
                  key={row.key}
                  taskId={taskId}
                  stage={stage}
                  row={row}
                  voice={voice}
                  readOnly={readOnly}
                  railLast={row.key === railKey}
                />
              ))}
              {endLine}
              {fixed}
              {/* An earlier conversation is read without what was queued: it sends nothing more. */}
              {!readOnly &&
                pending.map(
                  (entry) =>
                    entry.user !== null && (
                      <QueuedMessage
                        key={entry.id}
                        taskId={taskId}
                        stage={stage}
                        entryId={entry.id}
                        user={entry.user}
                        session={session}
                      />
                    ),
                )}
              {!readOnly && <Activity session={session} entries={entries} />}
            </>
          )}
        </div>
      </ConversationColumn>
      {!atBottom && (
        <BackToEnd
          newCount={newCount}
          voice={voice}
          work={streaming ? "writing" : session.turnRunning ? "working" : null}
          onClick={scrollToBottom}
        />
      )}
    </div>
  );
}
