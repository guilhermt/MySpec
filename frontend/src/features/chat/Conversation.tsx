import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { ConversationColumn } from "@/features/chat/ConversationColumn";
import {
  buildConversation,
  foldableStretches,
  lastMarkerOf,
  type Row,
  stretchFoldOf,
  waitingToolUseId,
} from "@/features/chat/conversation";
import { Activity } from "@/features/chat/entries/Activity";
import { BackToEnd } from "@/features/chat/entries/BackToEnd";
import { ErrorBlock } from "@/features/chat/entries/ErrorBlock";
import { Group } from "@/features/chat/entries/Group";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import { PermissionCard } from "@/features/chat/entries/PermissionCard";
import { QuestionCard } from "@/features/chat/entries/QuestionCard";
import { QueuedMessage } from "@/features/chat/entries/QueuedMessage";
import { Speech } from "@/features/chat/entries/Speech";
import { StretchFold } from "@/features/chat/entries/StretchFold";
import { YourMessage } from "@/features/chat/entries/YourMessage";
import {
  type MarkerContext,
  markerOf,
  productMessageOf,
  startLineOf,
  voiceInSentence,
  voiceOf,
} from "@/features/chat/markers";
import type { SessionState } from "@/features/chat/session";
import { useAutoScroll } from "@/features/chat/useAutoScroll";
import { useFeed } from "@/features/chat/useFeed";
import { asSituationKind, asTaskMode, type Entry } from "@/lib/wails";
import { useAppStore, useFlashing, useTask, useTranscript } from "@/store/app-store";

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

// useCardFlash is the kind of the pending card whose situation just started with the screen open,
// null without one: the question or the permission of an item blinks like its bar.
function useCardFlash(itemId: string): "question" | "permission" | null {
  const flashing = useFlashing();
  const app = useAppStore((state) => state.app);
  if (flashing.size === 0 || app === null) {
    return null;
  }
  const owners = [...(app.tasks ?? []), ...(app.reviews ?? []), ...(app.discussions ?? [])];
  const situation = owners
    .filter((owner) => owner.id === itemId)
    .flatMap((owner) => owner.situations ?? [])
    .find((one) => flashing.has(one.id));
  const kind = situation === undefined ? null : asSituationKind(situation.kind);
  return kind === "question" || kind === "permission" ? kind : null;
}

interface RowViewProps {
  taskId: string;
  stage: string;
  row: Row;
  voice: string;
  /** ctx is what a line needs of its conversation: the stage and the task. */
  ctx: MarkerContext;
  readOnly: boolean;
  /** railLast is the last speech, when it waits for a reply in text. */
  railLast: boolean;
  /** waitingToolUseId is the action the pending permission holds, null without one. */
  waitingToolUseId: string | null;
  /** requested is the marker the request bar asked to open, which settles the request. */
  requested: boolean;
  onRequested: () => void;
  /** flash is the kind of the pending card that blinks, null for none. */
  flash: "question" | "permission" | null;
}

function RowView({
  taskId,
  stage,
  row,
  voice,
  ctx,
  readOnly,
  railLast,
  waitingToolUseId,
  requested,
  onRequested,
  flash,
}: RowViewProps) {
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
    case "start":
      return (
        <MarkerLine
          view={startLineOf(row.marker, row.prompt, ctx)}
          createdAt={(row.marker ?? row.prompt)?.createdAt ?? ""}
          task={ctx.task}
        />
      );
    case "product":
      return row.entry.user === null ? null : (
        <MarkerLine
          view={productMessageOf(row.entry.user, voice, ctx)}
          createdAt={row.entry.createdAt}
          task={ctx.task}
        />
      );
    case "marker": {
      const view = row.entry.marker === null ? null : markerOf(row.entry.marker, ctx);
      return view === null ? null : (
        <MarkerLine
          view={view}
          createdAt={row.entry.createdAt}
          task={ctx.task}
          requested={requested}
          onRequested={onRequested}
        />
      );
    }
    case "group":
      return (
        <Group
          taskId={taskId}
          stage={stage}
          group={row.group}
          waitingToolUseId={waitingToolUseId}
        />
      );
    case "question":
      return row.entry.question === null ? null : (
        <QuestionCard
          taskId={taskId}
          stage={stage}
          question={row.entry.question}
          createdAt={row.entry.createdAt}
          readOnly={readOnly}
          flash={flash === "question"}
        />
      );
    case "permission":
      return row.entry.permission === null ? null : (
        <PermissionCard
          taskId={taskId}
          stage={stage}
          permission={row.entry.permission}
          createdAt={row.entry.createdAt}
          readOnly={readOnly}
          flash={flash === "permission"}
        />
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
  /** activity is what the place does at the end, in place of the work of the session: Opening the pull request… */
  activity?: string;
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
  activity,
  replyWaiting = false,
}: ConversationProps) {
  const transcript = useTranscript(taskId, stage);
  const task = useTask(taskId);
  const markerRequest = useAppStore((state) => state.markerRequest);
  const clearMarkerRequest = useAppStore((state) => state.clearMarkerRequest);
  const flash = useCardFlash(taskId);
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
  const waiting = useMemo(() => waitingToolUseId(entries), [entries]);
  const ctx = useMemo<MarkerContext>(
    () => ({ stage, task, oneShot: task !== null && asTaskMode(task.mode) === "one_shot" }),
    [stage, task],
  );
  // The stretches that fold are settled once, when the entries first arrive: a stretch that stops
  // being the last on screen stays open, so nothing folds under the reader.
  const [foldable, setFoldable] = useState<ReadonlySet<string> | null>(null);
  if (foldable === null && !loading) {
    setFoldable(foldableStretches(model));
  }
  const [openFolds, setOpenFolds] = useState<ReadonlySet<string>>(new Set());
  const toggleFold = (key: string) =>
    setOpenFolds((folds) => {
      const next = new Set(folds);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  // The live conversation of a task settles what its request bar asked to open: the last marker of
  // the type, its stretch unfolded; without one, the request is dropped.
  const asking = markerRequest !== null && markerRequest.taskId === taskId && !readOnly && !loading;
  const asked = asking ? lastMarkerOf(model, markerRequest.type) : null;
  const askedStretch = asked?.stretch ?? null;

  useEffect(() => {
    if (!asking) {
      return;
    }
    if (askedStretch === null) {
      clearMarkerRequest();
      return;
    }
    setOpenFolds((folds) => (folds.has(askedStretch) ? folds : new Set(folds).add(askedStretch)));
  }, [asking, askedStretch, clearMarkerRequest]);

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
              {model.stretches.map((stretch) => {
                const views = stretch.rows.map((row) => (
                  <RowView
                    key={row.key}
                    taskId={taskId}
                    stage={stage}
                    row={row}
                    voice={voice}
                    ctx={ctx}
                    readOnly={readOnly}
                    railLast={row.key === railKey}
                    waitingToolUseId={waiting}
                    requested={row.key === asked?.row}
                    onRequested={clearMarkerRequest}
                    flash={readOnly ? null : flash}
                  />
                ));
                return foldable?.has(stretch.key) ? (
                  <StretchFold
                    key={stretch.key}
                    fold={stretchFoldOf(stretch, ctx, Date.now())}
                    open={openFolds.has(stretch.key)}
                    onToggle={() => toggleFold(stretch.key)}
                  >
                    {views}
                  </StretchFold>
                ) : (
                  <Fragment key={stretch.key}>{views}</Fragment>
                );
              })}
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
              {!readOnly &&
                (activity !== undefined ? (
                  <Activity text={activity} />
                ) : (
                  <Activity session={session} entries={entries} />
                ))}
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
