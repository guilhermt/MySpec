import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { Continue } from "@/components/system/Continue";
import { EmptyState } from "@/components/system/EmptyState";
import { ICONS } from "@/components/system/icons";
import { Kbd } from "@/components/system/Kbd";
import { ScrollArea } from "@/components/system/ScrollArea";
import {
  BoardStartRow,
  type ChangePathError,
  NoBoardRow,
  StartRow,
} from "@/components/system/StartRow";
import { useNow } from "@/features/attention/useNow";
import { boardLines, continueItem, noBoardLine, reviewSubtitle } from "@/features/home/home";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { discussionTarget } from "@/features/sidebar/new-discussion-board";
import { messageOf } from "@/lib/errors";
import { changeRepositoryPath, cloneRepository, refreshBoard } from "@/store/actions";
import { readLastItem, useAppStore, useLocation, useReviewCenter } from "@/store/app-store";

/** SHORTCUTS are the keys the Home lists at its foot. */
const SHORTCUTS: readonly { keys: readonly string[]; text: string }[] = [
  { keys: ["Ctrl", "J"], text: "Next that needs you" },
  { keys: ["Ctrl", "N"], text: "New task" },
  { keys: ["Alt", "←"], text: "Back" },
  { keys: ["Ctrl", ","], text: "Settings" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-(--space-2)">
      <h2
        id={titleId}
        className="text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) text-ink-3 uppercase"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Home is the main area with nothing else open: where to continue, what to start and the boards,
 * with the keys that move between them.
 */
export function Home() {
  const app = useAppStore((state) => state.app);
  const location = useLocation();
  const back = useAppStore((state) => state.back);
  const pendingFocus = useAppStore((state) => state.pendingFocus);
  const go = useAppStore((state) => state.go);
  const openNewTask = useAppStore((state) => state.openNewTask);
  const openReviews = useAppStore((state) => state.openReviews);
  const openBoard = useAppStore((state) => state.openBoard);
  const openSituation = useAppStore((state) => state.openSituation);
  const openNewDiscussion = useAppStore((state) => state.openNewDiscussion);
  const reviewCenter = useReviewCenter();
  const now = useNow(60_000, true);

  const [cloneErrors, setCloneErrors] = useState<Record<string, string>>({});
  const [pathError, setPathError] = useState<ChangePathError | null>(null);
  const column = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the last item is read again with each place
  const lastItem = useMemo(() => readLastItem(), [location]);
  const model = app === null ? null : continueItem(app, location, back, lastItem, now);
  const lines = app === null ? [] : boardLines(app, now);
  const noBoard = app === null ? null : noBoardLine(app);
  const discussion = discussionTarget(app, location);
  const reviews = reviewSubtitle(reviewCenter);

  // The focus starts on Continue, or on the first row without it, unless a navigation asked for
  // another place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the Home opens
  useEffect(() => {
    if (pendingFocus === null) {
      column.current?.querySelector("button")?.focus();
    }
  }, []);

  const clone = (repositoryId: string) => {
    setCloneErrors(({ [repositoryId]: _dropped, ...rest }) => rest);
    cloneRepository(repositoryId).catch((reason: unknown) =>
      setCloneErrors((errors) => ({ ...errors, [repositoryId]: messageOf(reason) })),
    );
  };

  const changePath = (repositoryId: string) => {
    setPathError(null);
    changeRepositoryPath(repositoryId).catch((reason: unknown) =>
      setPathError({ repositoryId, message: messageOf(reason) }),
    );
  };

  const withErrors = <T extends { kind: string }>(blockers: readonly T[]): T[] =>
    blockers.map((blocker) => {
      const id = "repositoryId" in blocker ? String(blocker.repositoryId) : "";
      const error = cloneErrors[id];
      return blocker.kind === "not-cloned" && error !== undefined
        ? { ...blocker, text: error, error }
        : blocker;
    });

  const actions = {
    onClone: clone,
    onChangePath: changePath,
    changePathError: pathError,
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-surface-1 text-ink-1">
      <LocationHeader />
      <ScrollArea className="min-h-0 flex-1">
        <div
          ref={column}
          className="mx-auto flex w-[round(down,var(--measure-read),1px)] max-w-full flex-col gap-(--space-8) px-(--space-6) pt-[calc(var(--space-16)+var(--space-8))] pb-(--space-12)"
        >
          <Section title="Continue">
            {model === null ? (
              <EmptyState title="Nothing in progress">
                No task, review or discussion is active. Start one from a card, a pull request or a
                board.
              </EmptyState>
            ) : (
              <Continue
                model={model}
                onOpen={() =>
                  model.situation === null
                    ? go(model.location)
                    : openSituation(model.situation.itemId, model.situation.place)
                }
              />
            )}
          </Section>

          <Section title="Start">
            <div className="flex flex-col">
              <StartRow
                icon={ICONS.plus}
                label="New task"
                sub="From scratch. A card starts its task on its board."
                shortcut="Ctrl N"
                onClick={() => openNewTask()}
              />
              <StartRow
                icon={ICONS.review}
                label="Review a pull request"
                sub={reviews.text}
                subShimmer={reviews.shimmer}
                onClick={() => openReviews()}
              />
              <StartRow
                icon={ICONS.discussion}
                label="New discussion"
                sub="About the demand of one board"
                {...(discussion.kind === "disabled" ? { disabledReason: discussion.reason } : {})}
                onClick={() => {
                  if (discussion.kind === "open") {
                    openNewDiscussion({
                      boardId: discussion.boardId,
                      cardKeys: [],
                      askBoard: discussion.askBoard,
                    });
                  }
                }}
              />
            </div>
          </Section>

          <Section title="Boards">
            <div className="flex flex-col">
              {lines.map((line) => (
                <BoardStartRow
                  key={line.boardId}
                  line={{ ...line, blockers: withErrors(line.blockers) }}
                  onOpen={() => openBoard(line.boardId)}
                  onRetryRead={() => void refreshBoard(line.boardId)}
                  {...actions}
                />
              ))}
              {noBoard !== null && (
                <NoBoardRow
                  names={noBoard.names}
                  blockers={withErrors(noBoard.blockers)}
                  {...actions}
                />
              )}
            </div>
          </Section>

          <p className="flex flex-wrap gap-x-(--space-5) gap-y-(--space-1) text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
            <span className="sr-only">Shortcuts: </span>
            {SHORTCUTS.map(({ keys, text }) => (
              <span key={text} className="inline-flex items-center gap-(--space-1-5)">
                <span className="inline-flex gap-(--space-0-5)">
                  {keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
                {text}
              </span>
            ))}
          </p>
        </div>
      </ScrollArea>
    </section>
  );
}
