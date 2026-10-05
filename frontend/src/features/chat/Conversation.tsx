import {
  Fragment,
  memo,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { useWindowedRows } from "@/components/system/useWindowedRows";
import { ConversationColumn } from "@/features/chat/ConversationColumn";
import { type Pending, pendingOf } from "@/features/chat/composer";
import {
  buildConversation,
  type ConversationModel,
  foldableStretches,
  lastMarkerOf,
  type Row,
  stretchFoldOf,
  waitingToolUseId,
} from "@/features/chat/conversation";
import {
  type ConversationUnit,
  conversationUnits,
  unitArticles,
} from "@/features/chat/conversation-units";
import { type DiscussionInput, roundFolds } from "@/features/chat/discussion-markers";
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
  discussionOpeningOf,
  type MarkerContext,
  markerOf,
  productMessageOf,
  startLineOf,
  voiceInSentence,
  voiceOf,
} from "@/features/chat/markers";
import type { SessionState } from "@/features/chat/session";
import { useAutoScroll } from "@/features/chat/useAutoScroll";
import { type FeedUnits, useFeed } from "@/features/chat/useFeed";
import { decidedMarkerIds, reportMarkerIds } from "@/features/reviews/review-conversation";
import { bottomPadding } from "@/lib/reveal";
import { asSituationKind, asTaskMode, type Entry, type UserEntry } from "@/lib/wails";
import { useAppStore, useFlashing, useReview, useTask, useTranscript } from "@/store/app-store";

const NO_ENTRIES: readonly Entry[] = [];
const NO_FOLDS: ReadonlySet<string> = new Set();

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

// messageOf is what the user wrote at the start of a discussion, as an entry of the conversation.
function messageOf(text: string): UserEntry {
  return {
    text,
    pending: false,
    prompt: false,
    app: false,
    sent: "",
    appKind: "",
    appPass: 0,
    appRound: 0,
    appRounds: 0,
    appCount: 0,
  };
}

// signature is a value as text, Maps and Sets by their entries.
function signature(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item instanceof Map || item instanceof Set ? [...item] : item,
  );
}

// useSteady is the last value that has the signature of the one given.
function useSteady<T>(value: T, sign: (value: T) => string): T {
  const steady = useRef({ value, sign: sign(value) });
  const next = sign(value);
  if (steady.current.sign !== next) {
    steady.current = { value, sign: next };
  }
  return steady.current.value;
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

const RowView = memo(function RowView({
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
    case "start": {
      const opening = discussionOpeningOf(row.prompt, ctx);
      const createdAt = row.prompt?.createdAt ?? "";
      return (
        <>
          <MarkerLine
            view={startLineOf(row.marker, row.prompt, ctx)}
            createdAt={(row.marker ?? row.prompt)?.createdAt ?? ""}
            task={ctx.task}
            review={ctx.review}
            discussion={ctx.discussion}
          />
          {opening.context !== null && (
            <MarkerLine
              view={opening.context}
              createdAt={createdAt}
              task={ctx.task}
              review={ctx.review}
              discussion={ctx.discussion}
            />
          )}
          {opening.message !== "" && (
            <YourMessage user={messageOf(opening.message)} createdAt={createdAt} />
          )}
        </>
      );
    }
    case "product":
      return row.entry.user === null ? null : (
        <MarkerLine
          view={productMessageOf(row.entry.user, voice, ctx)}
          createdAt={row.entry.createdAt}
          task={ctx.task}
          review={ctx.review}
          discussion={ctx.discussion}
        />
      );
    case "marker": {
      const view = row.entry.marker === null ? null : markerOf(row.entry.marker, ctx, row.entry.id);
      return view === null ? null : (
        <MarkerLine
          view={view}
          createdAt={row.entry.createdAt}
          task={ctx.task}
          review={ctx.review}
          discussion={ctx.discussion}
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
});

// The heights of a unit before it is measured, in whole pixels: a line of text is --leading-body
// tall, a card or a block adds its padding, and a text breaks about every CHARS_PER_LINE characters
// in the conversation column. The measure of the real one wins and is kept by the key of the unit.
const FOLD_PX = 28;
const LINE_PX = 22;
const CHARS_PER_LINE = 110;
const SPEECH_PAD_PX = 8;
const SPEECH_MIN_PX = 30;
const MESSAGE_PAD_PX = 24;
const MARKER_PX = 28;
const GROUP_PX = 28;
const CARD_PX = 160;
const ERROR_PX = 96;
const AFTER_PX = 140;

/** WINDOW_MIN_UNITS is how many units a conversation holds before it is windowed: a shorter one mounts them all. */
const WINDOW_MIN_UNITS = 60;

/** WINDOW_OVERSCAN is how many units are mounted past each end of what shows. */
const WINDOW_OVERSCAN = 6;

// estimateOf is the height of a unit before it is measured.
function estimateOf(unit: ConversationUnit, hasAfter: boolean): number {
  const extra = hasAfter ? AFTER_PX : 0;
  if (unit.kind === "fold") {
    return FOLD_PX;
  }
  const { row } = unit;
  switch (row.kind) {
    case "speech": {
      const chars = row.entry.assistant?.text.length ?? 0;
      return (
        Math.max(SPEECH_MIN_PX, LINE_PX * Math.ceil(chars / CHARS_PER_LINE) + SPEECH_PAD_PX) + extra
      );
    }
    case "user":
    case "product": {
      const chars = row.entry.user?.text.length ?? 0;
      return LINE_PX * Math.ceil(chars / CHARS_PER_LINE) + MESSAGE_PAD_PX + extra;
    }
    case "marker":
    case "start":
      return MARKER_PX + extra;
    case "group":
      return GROUP_PX + extra;
    case "question":
    case "permission":
      return CARD_PX + extra;
    case "error":
      return ERROR_PX + extra;
  }
}

// isPendingRow tells whether a row is the question or the permission pendingOf points at.
function isPendingRow(row: Row, pending: Pending): boolean {
  return (
    (row.kind === "question" &&
      pending.question !== null &&
      row.entry.question === pending.question) ||
    (row.kind === "permission" &&
      pending.permission !== null &&
      row.entry.permission === pending.permission)
  );
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
  /**
   * after is what is drawn right after an entry, by its id: a line derived from the data, like the
   * decisions of a pass the conversation never recorded. An id not in the conversation draws its node
   * at the end, after endLine.
   */
  after?: ReadonlyMap<string, ReactNode>;
  /**
   * before is what is drawn right before an entry, by its id: the round a discussion folded before
   * its next Drafts written. An id not in the conversation draws its node at the end, before the
   * nodes of after that aren't there either.
   */
  before?: ReadonlyMap<string, ReactNode>;
  /** discussion is what the conversation of a discussion knows of it, for its markers; null elsewhere. */
  discussion?: DiscussionInput | null;
  /** endLine is the derived line after the entries (Merged …, Closed …). */
  endLine?: ReactNode;
  /** fixed is the fixed card after the entries: changed files, the PR draft, the live checks. */
  fixed?: ReactNode;
  /** activity is what the place does at the end, in place of the work of the session: Opening the pull request… */
  activity?: string;
  /** replyWaiting marks the last block of the last speech with the rail of a question in text (the reply situation). */
  replyWaiting?: boolean;
  /** endRoom leaves room at the end as high as the way back to the end: a discussion, whose card of drafts ends its conversation. */
  endRoom?: boolean;
  /** pillAvoids is a selector: the way back to the end isn't drawn while an element that matches crosses the strip it floats in. */
  pillAvoids?: string;
}

/**
 * usePillCovered tells whether an element that matches the selector crosses the strip at the bottom
 * of the viewport, as high as its scroll padding: where the way back to the end floats. It measures
 * on the scroll and when the content resizes, a frame later.
 */
function usePillCovered(
  viewportRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  selector: string | undefined,
): boolean {
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (selector === undefined || viewport === null) {
      setCovered(false);
      return;
    }
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = viewport.getBoundingClientRect();
        const strip = box.bottom - bottomPadding(viewport);
        const crosses = [...viewport.querySelectorAll<HTMLElement>(selector)].some((element) => {
          const rect = element.getBoundingClientRect();
          return rect.bottom > strip && rect.top < box.bottom;
        });
        setCovered(crosses);
      });
    };
    measure();
    viewport.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    if (contentRef.current !== null) {
      observer.observe(contentRef.current);
    }
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [viewportRef, contentRef, selector]);
  return covered;
}

/** Conversation is everything that was said and done, from the top down, as a feed. */
export function Conversation({
  taskId,
  stage,
  session,
  readOnly = false,
  after,
  before,
  discussion = null,
  endLine,
  fixed,
  activity,
  replyWaiting = false,
  endRoom = false,
  pillAvoids,
}: ConversationProps) {
  const transcript = useTranscript(taskId, stage);
  const task = useTask(taskId);
  const review = useReview(taskId);
  const markerRequest = useAppStore((state) => state.markerRequest);
  const clearMarkerRequest = useAppStore((state) => state.clearMarkerRequest);
  const flash = useCardFlash(taskId);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);
  const pillCovered = usePillCovered(viewportRef, contentRef, pillAvoids);
  // currentUnit is the unit that holds the tab stop of the feed, -1 for the tail: it stays mounted.
  const [currentUnit, setCurrentUnit] = useState(-1);

  const entries = transcript?.entries ?? NO_ENTRIES;
  const pending = transcript?.pending ?? NO_ENTRIES;
  const voice = voiceOf(stage);
  const built = useRef<ConversationModel | null>(null);
  const model = useMemo(() => buildConversation(entries, voice, built.current), [entries, voice]);
  built.current = model;
  const rows = useMemo(() => model.stretches.flatMap((stretch) => stretch.rows), [model]);
  const rowKeys = useMemo(() => rows.map((row) => row.key), [rows]);
  // The text of the last entry is what grows while the agent writes.
  const last = entries.at(-1);
  const streaming = last?.assistant ? !last.assistant.complete : false;
  const { atBottom, newCount, scrollToBottom, followingEnd } = useAutoScroll(
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
  // What the lines of the conversation read of it keeps its identity while it holds the same,
  // so the text that grows does not redraw them all.
  const latestReport = useSteady(reportMarkerIds(entries), signature);
  const latestDecided = useSteady(decidedMarkerIds(entries), signature);
  const folds = useSteady(
    discussion === null ? null : roundFolds(entries, discussion.drafts),
    signature,
  );
  const discussionCtx = useMemo(
    () => (discussion === null || folds === null ? null : { ...discussion, folds }),
    [discussion, folds],
  );
  const ctx = useMemo<MarkerContext>(
    () => ({
      stage,
      task,
      review,
      latestReport,
      latestDecided,
      oneShot: task !== null && asTaskMode(task.mode) === "one_shot",
      discussion: discussionCtx,
    }),
    [stage, task, review, latestReport, latestDecided, discussionCtx],
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

  const units = useMemo(
    () =>
      conversationUnits(
        model,
        {
          foldable: foldable ?? NO_FOLDS,
          open: openFolds,
          anchored: (stretch) =>
            stretch.rows.some((row) => after?.has(row.key) || before?.has(row.key)),
        },
        ctx,
      ),
    [model, foldable, openFolds, ctx, after, before],
  );
  const pendingCards = useMemo(() => pendingOf(entries), [entries]);
  const pinned = useMemo(() => {
    if (units.length <= WINDOW_MIN_UNITS) {
      return units.map((_unit, index) => index);
    }
    const out = new Set<number>([units.length - 1, currentUnit]);
    units.forEach((unit, index) => {
      if (
        unit.kind === "row" &&
        (isPendingRow(unit.row, pendingCards) ||
          before?.has(unit.row.key) ||
          after?.has(unit.row.key) ||
          unit.row.key === asked?.row)
      ) {
        out.add(index);
      }
    });
    return [...out].sort((a, b) => a - b);
  }, [units, currentUnit, before, after, asked?.row, pendingCards]);
  const { parts, measureRef, scrollToIndex, attached } = useWindowedRows({
    count: units.length,
    keyOf: (index) => units[index]?.key ?? String(index),
    estimate: (index) => {
      const unit = units[index];
      return unit === undefined
        ? 0
        : estimateOf(unit, unit.kind === "row" && after?.has(unit.row.key) === true);
    },
    pinned,
    scrollRef: viewportRef,
    listRef: feedRef,
    overscan: WINDOW_OVERSCAN,
    keepEnd: readOnly ? undefined : followingEnd,
    startAtEnd: !readOnly,
  });
  // It is new each time the window mounts other units: the feed syncs what came in.
  const mountedKey = parts.map((part) => part.key).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: mountedKey makes it new with the window
  const feedUnits = useMemo<FeedUnits>(
    () => ({
      count: units.length,
      reveal: (index) => scrollToIndex(index),
      onCurrent: setCurrentUnit,
    }),
    [units.length, scrollToIndex, mountedKey],
  );
  useFeed(feedRef, feedUnits);

  // The articles of the top level are numbered over the whole conversation: the units that are
  // mounted by what comes before them, and the tail after the units.
  const articleOffsets = useMemo(() => {
    let total = 0;
    const offsets = units.map((unit) => {
      const offset = total;
      total += unitArticles(unit, ctx, before, after);
      return offset;
    });
    return { offsets, total };
  }, [units, ctx, before, after]);
  // It runs on every render: the window moves, and what it mounts is numbered.
  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (feed === null) {
      return;
    }
    const tail = [...feed.querySelectorAll<HTMLElement>(":scope > article:not([role])")];
    const size = articleOffsets.total + tail.length;
    const number = (article: HTMLElement, position: number) => {
      article.setAttribute("aria-posinset", String(position));
      article.setAttribute("aria-setsize", String(size));
    };
    for (const element of feed.querySelectorAll<HTMLElement>(":scope > [data-unit-index]")) {
      const offset = articleOffsets.offsets[Number(element.dataset.unitIndex)] ?? 0;
      for (const [at, article] of element
        .querySelectorAll<HTMLElement>(":scope > article:not([role])")
        .entries()) {
        number(article, offset + at + 1);
      }
    }
    for (const [at, article] of tail.entries()) {
      number(article, articleOffsets.total + at + 1);
    }
  });

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
      <ConversationColumn
        viewportRef={viewportRef}
        contentRef={contentRef}
        fadeTop={!atTop}
        endRoom={endRoom}
      >
        <div
          ref={feedRef}
          role="feed"
          aria-label={`Conversation with the ${voiceInSentence(voice)}`}
          aria-busy={streaming}
          className="flex flex-col gap-(--space-3)"
        >
          {/* The rows and what follows them mount together, once the window knows its scroll. */}
          {loading || !attached ? (
            <Loading />
          ) : (
            <>
              {parts.map((part) => {
                if (part.kind === "spacer") {
                  return (
                    <div
                      key={part.key}
                      aria-hidden="true"
                      role="none"
                      style={{ height: part.height }}
                    />
                  );
                }
                const unit = units[part.index];
                if (unit === undefined) {
                  return null;
                }
                return (
                  <div
                    key={part.key}
                    role="none"
                    ref={measureRef}
                    data-index={part.index}
                    data-unit-index={part.index}
                    className="flex flex-col gap-(--space-3)"
                  >
                    {unit.kind === "fold" ? (
                      <StretchFold
                        fold={stretchFoldOf(unit.stretch, ctx, Date.now())}
                        open={unit.open}
                        onToggle={() => toggleFold(unit.stretch.key)}
                      />
                    ) : (
                      <>
                        {before?.get(unit.row.key)}
                        <RowView
                          taskId={taskId}
                          stage={stage}
                          row={unit.row}
                          voice={voice}
                          ctx={ctx}
                          readOnly={readOnly}
                          railLast={unit.row.key === railKey}
                          waitingToolUseId={waiting}
                          requested={unit.row.key === asked?.row}
                          onRequested={clearMarkerRequest}
                          flash={readOnly ? null : flash}
                        />
                        {after?.get(unit.row.key)}
                      </>
                    )}
                  </div>
                );
              })}
              {endLine}
              {[...(before ?? [])]
                .filter(([key]) => !rowKeys.includes(key))
                .map(([key, node]) => (
                  <Fragment key={key}>{node}</Fragment>
                ))}
              {[...(after ?? [])]
                .filter(([key]) => !rowKeys.includes(key))
                .map(([key, node]) => (
                  <Fragment key={key}>{node}</Fragment>
                ))}
              {fixed}
              {/* An earlier conversation is read without what was queued: it sends nothing more.
                  What the product sends is never queued: its prompt's start is already a marker,
                  and a message of the workflow is its marker, with nothing to remove. */}
              {!readOnly &&
                pending.map((entry) => {
                  const user = entry.user;
                  if (user === null || user.prompt) {
                    return null;
                  }
                  return user.app ? (
                    <MarkerLine
                      key={entry.id}
                      view={productMessageOf(user, voice, ctx)}
                      createdAt={entry.createdAt}
                      task={ctx.task}
                      review={ctx.review}
                      discussion={ctx.discussion}
                    />
                  ) : (
                    <QueuedMessage
                      key={entry.id}
                      taskId={taskId}
                      stage={stage}
                      entryId={entry.id}
                      user={user}
                      session={session}
                    />
                  );
                })}
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
      {!atBottom && !pillCovered && (
        <BackToEnd
          newCount={newCount}
          voice={voice}
          work={streaming ? "writing" : session.turnRunning ? "working" : null}
          // To the end of what scrolls, the tail included: the units that come into view measure
          // themselves and the scroll follows the end as they do.
          onClick={scrollToBottom}
        />
      )}
    </div>
  );
}
