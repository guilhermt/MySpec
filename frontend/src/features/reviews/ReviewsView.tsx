import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { KeyNotice, useKeyNotice } from "@/components/system/KeyNotice";
import { ScrollArea } from "@/components/system/ScrollArea";
import { useNow } from "@/features/attention/useNow";
import { FLASH_MS, isTyping, LIST_COLUMN } from "@/features/board/BoardView";
import { PullRequestTree } from "@/features/reviews/PullRequestTree";
import { ReviewsFilterBar } from "@/features/reviews/ReviewsFilterBar";
import { ReviewsHeader } from "@/features/reviews/ReviewsHeader";
import {
  NoMatch,
  NoPullRequests,
  NoRepositories,
  ReadingSkeleton,
  ReviewsFailureStrips,
} from "@/features/reviews/ReviewsReadingStates";
import {
  EMPTY_REVIEW_FILTERS,
  pullRequestRowModel,
  reviewKeyNotice,
  reviewRows,
  reviewSections,
  reviewsReadingView,
} from "@/features/reviews/review-list";
import { useReviewsSectionsMemory } from "@/features/reviews/useReviewsSectionsMemory";
import { asPullRequestAction, type PullRequestRow } from "@/lib/wails";
import { openExternal, refreshPullRequests, setReviewFilters } from "@/store/actions";
import { useAppStore, useReviewCenter } from "@/store/app-store";

/** READING_CLOCK_MS is how often the time since the last reading is told again: a minute. */
const READING_CLOCK_MS = 60_000;

const NO_ROWS: PullRequestRow[] = [];

const NO_KEYS: ReadonlySet<string> = new Set();

/** ReviewsView is the open pull requests of every registered repository, as the filters show them. */
export function ReviewsView() {
  const app = useAppStore((state) => state.app);
  const openStartReview = useAppStore((state) => state.openStartReview);
  const openReview = useAppStore((state) => state.openReview);
  const openTask = useAppStore((state) => state.openTask);
  const center = useReviewCenter();
  const [collapsed, toggleSection] = useReviewsSectionsMemory();
  const notice = useKeyNotice();
  const treeRef = useRef<HTMLDivElement>(null);
  const now = useNow(READING_CLOCK_MS, center.readAt !== "" || (center.failures ?? []).length > 0);
  const [newKeys, setNewKeys] = useState<ReadonlySet<string>>(NO_KEYS);
  const pullRequests = center.pullRequests ?? NO_ROWS;

  // Opening the view reads the pull requests again; the stored reading shows
  // meanwhile.
  useEffect(() => {
    void refreshPullRequests();
  }, []);

  // The pull requests a reading brings that the one before did not have flash, when it had any.
  const keys = useMemo(() => new Set(pullRequests.map((row) => row.key)), [pullRequests]);
  const readKeys = useRef(keys);
  useEffect(() => {
    const before = readKeys.current;
    readKeys.current = keys;
    const brought = [...keys].filter((key) => !before.has(key));
    if (before.size === 0 || brought.length === 0) {
      return;
    }
    setNewKeys(new Set(brought));
  }, [keys]);

  // The flash ends on its own timer, which a later reading does not cancel.
  useEffect(() => {
    if (newKeys.size === 0) {
      return;
    }
    const timer = setTimeout(() => setNewKeys(NO_KEYS), FLASH_MS);
    return () => clearTimeout(timer);
  }, [newKeys]);

  const rows = useMemo(() => reviewRows(reviewSections(center), collapsed), [center, collapsed]);
  const models = useMemo(() => {
    if (app === null) {
      return new Map();
    }
    const ctx = { app, now };
    return new Map(
      rows.flatMap((row) =>
        row.kind === "pr" ? [[row.row.key, pullRequestRowModel(row.row, ctx)]] : [],
      ),
    );
  }, [app, now, rows]);

  // act is what R does on a pull request, and what a click or Enter on its row does until the panel
  // takes them: a repository without a clone is offered one by the dialog itself.
  const act = (row: PullRequestRow, anchor: Element) => {
    if (app === null) {
      return;
    }
    const text = reviewKeyNotice(row, app);
    if (text !== null) {
      notice.show(anchor, text);
      return;
    }
    switch (asPullRequestAction(row.action)) {
      case "review":
      case "clone":
        openStartReview({ repositoryId: row.repositoryId, number: row.number });
        break;
      case "open_review":
        openReview(row.reviewId);
        break;
      case "open_task":
        openTask(row.taskId);
        break;
      case "clone_missing":
      case "fork":
        break;
    }
  };
  const rowElement = (key: string) =>
    Array.from(treeRef.current?.querySelectorAll<HTMLElement>("[data-row-key]") ?? []).find(
      (element) => element.getAttribute("data-row-key") === key,
    ) ?? treeRef.current;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target;
    // Dialogs and menus render in a portal: their keys are not the view's.
    if (!(target instanceof Element) || !event.currentTarget.contains(target)) {
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || isTyping(target)) {
      return;
    }
    if (event.key === "Escape") {
      if (notice.notice === null) {
        return;
      }
      notice.hide();
      event.preventDefault();
      return;
    }
    const element = target.closest<HTMLElement>("[data-row-key]");
    const row =
      element === null
        ? undefined
        : pullRequests.find((candidate) => candidate.key === element.getAttribute("data-row-key"));
    if (element === null || row === undefined) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "r") {
      event.preventDefault();
      act(row, element);
    } else if (key === "o") {
      event.preventDefault();
      void openExternal(row.url);
    }
  };

  const view = app === null ? "skeleton" : reviewsReadingView(app);
  let content: React.ReactNode;
  if (view === "skeleton") {
    content = <ReadingSkeleton />;
  } else if (app !== null && view === "no-repositories") {
    content = <NoRepositories />;
  } else if (app !== null && view === "no-pull-requests") {
    content = <NoPullRequests app={app} />;
  } else if (view === "no-match") {
    content = (
      <NoMatch center={center} onClear={() => void setReviewFilters(EMPTY_REVIEW_FILTERS)} />
    );
  } else {
    content = (
      <PullRequestTree
        rows={rows}
        models={models}
        openKey={null}
        newKeys={newKeys}
        treeRef={treeRef}
        onToggleSection={toggleSection}
        onActivate={(row) => act(row, rowElement(row.key) ?? document.body)}
      />
    );
  }

  const showsBar = view === "list" || view === "no-match";

  return (
    <section
      aria-label="Reviews"
      onKeyDown={onKeyDown}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1"
    >
      <ReviewsHeader center={center} now={now} />
      <ScrollArea className="list-area min-h-0 flex-1">
        <div className={LIST_COLUMN}>
          <ReviewsFailureStrips center={center} now={now} />
          {showsBar && <ReviewsFilterBar center={center} />}
          {content}
        </div>
      </ScrollArea>
      <KeyNotice notice={notice.notice} onHide={notice.hide} />
    </section>
  );
}
