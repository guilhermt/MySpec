import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { PanelLayout } from "@/components/system/AuxPanel";
import { KeyNotice, useKeyNotice } from "@/components/system/KeyNotice";
import { isTyping } from "@/components/system/keys";
import { LIST_COLUMN } from "@/components/system/ListPanel";
import { ScrollArea } from "@/components/system/ScrollArea";
import { useNow } from "@/features/attention/useNow";
import { PullRequestPanel } from "@/features/reviews/PullRequestPanel";
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
import { FLASH_MS } from "@/lib/situations";
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
  // The pull request of the panel, and the request to focus its clone button, which R makes.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [panelFocus, setPanelFocus] = useState<"clone" | null>(null);
  const pullRequests = center.pullRequests ?? NO_ROWS;
  const openRow =
    openKey === null ? null : (pullRequests.find((row) => row.key === openKey) ?? null);

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
  // rowKeys are the pull requests the list draws, in the order it draws them.
  const rowKeys = useMemo(
    () => rows.flatMap((row) => (row.kind === "pr" ? [row.row.key] : [])),
    [rows],
  );
  const visibleKeys = useRef<readonly string[]>(rowKeys);
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

  // rowElement is the row of a pull request, or the tab stop of the list when the row is not drawn.
  const rowElement = (key: string) =>
    Array.from(treeRef.current?.querySelectorAll<HTMLElement>("[data-row-key]") ?? []).find(
      (element) => element.getAttribute("data-row-key") === key,
    ) ?? treeRef.current?.querySelector<HTMLElement>('[tabindex="0"]');

  // A pull request that leaves the reading takes its panel with it. When the focus was in the panel,
  // or had nowhere to fall, it goes to the row that follows the one that left, else the one before,
  // else the tab stop of the list.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs when the list or the open pull request changes; rowElement only reads the DOM
  useEffect(() => {
    const before = visibleKeys.current;
    visibleKeys.current = rowKeys;
    if (openKey === null || openRow !== null) {
      return;
    }
    setOpenKey(null);
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.closest(".list-panel") === null) {
      return;
    }
    const alive = new Set(rowKeys);
    const index = before.indexOf(openKey);
    const target =
      index < 0
        ? undefined
        : (before.slice(index + 1).find((key) => alive.has(key)) ??
          before
            .slice(0, index)
            .reverse()
            .find((key) => alive.has(key)));
    (target === undefined
      ? treeRef.current?.querySelector<HTMLElement>('[tabindex="0"]')
      : rowElement(target)
    )?.focus();
  }, [rowKeys, openKey, openRow]);

  // closePanel closes the pull request; the focus goes back to its row only when it was in the
  // panel, and a focus on the list stays where it is.
  const closePanel = () => {
    const inPanel = document.activeElement?.closest(".list-panel") != null;
    setOpenKey(null);
    if (inPanel && openKey !== null) {
      rowElement(openKey)?.focus();
    }
  };

  // activate is what a click or Enter on a row does: it opens the panel of that pull request, and
  // on the open one closes it.
  const activate = (row: PullRequestRow) => setOpenKey(openKey === row.key ? null : row.key);

  // act is what R does on a pull request, from its row or from its panel.
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
        openStartReview({ repositoryId: row.repositoryId, number: row.number });
        break;
      case "clone":
        // A repository without a clone offers it in the panel: the dialog opens when the clone ends.
        setOpenKey(row.key);
        setPanelFocus("clone");
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
      if (notice.notice !== null) {
        notice.hide();
      } else if (openKey !== null) {
        closePanel();
      } else {
        return;
      }
      event.preventDefault();
      return;
    }
    const element = target.closest<HTMLElement>("[data-row-key]");
    const panel = target.closest(".list-panel");
    const row =
      element === null
        ? undefined
        : pullRequests.find((candidate) => candidate.key === element.getAttribute("data-row-key"));
    const pull = row ?? (panel === null ? null : openRow);
    if (pull === null || pull === undefined) {
      return;
    }
    const anchor =
      element ??
      panel?.querySelector("[data-panel-actions]") ??
      treeRef.current?.querySelector('[tabindex="0"]') ??
      target;
    const key = event.key.toLowerCase();
    if (key === "r") {
      event.preventDefault();
      act(pull, anchor);
    } else if (key === "o") {
      event.preventDefault();
      void openExternal(pull.url);
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
        openKey={openKey}
        newKeys={newKeys}
        treeRef={treeRef}
        onToggleSection={toggleSection}
        onActivate={activate}
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
      <PanelLayout
        panel={
          openRow !== null && (
            <PullRequestPanel
              key={openRow.key}
              row={openRow}
              now={now}
              panelFocus={panelFocus}
              onPanelFocused={() => setPanelFocus(null)}
              onClose={closePanel}
            />
          )
        }
      >
        <ScrollArea className="list-area min-h-0 flex-1">
          <div className={LIST_COLUMN}>
            <ReviewsFailureStrips center={center} now={now} />
            {showsBar && <ReviewsFilterBar center={center} />}
            {content}
          </div>
        </ScrollArea>
      </PanelLayout>
      <KeyNotice notice={notice.notice} onHide={notice.hide} />
    </section>
  );
}
