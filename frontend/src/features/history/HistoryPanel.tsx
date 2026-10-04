import { ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { pluralize } from "@/features/boards/board-dialog";
import { formatDates, stepCount } from "@/features/history/history-format";
import { historyEntries } from "@/features/history/history-list";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { outcomeLabel } from "@/features/reviews/review-status";
import { RepositoryFilter } from "@/features/sidebar/RepositoryFilter";
import { olderKey } from "@/lib/history";
import { shortName } from "@/lib/repositories";
import { isOneShot } from "@/lib/task-modes";
import type { ArchivedDiscussion, ArchivedPR, ArchivedReview, ArchivedTask } from "@/lib/wails";
import { loadOlderHistory, openExternal } from "@/store/actions";
import {
  useAppStore,
  useHistorySummary,
  useHistoryUi,
  useRepository,
  useRepositoryFilter,
} from "@/store/app-store";

const NO_IDS: readonly string[] = [];

const ROW =
  "flex h-10 w-full items-center gap-2 rounded-md px-2 text-left outline-none transition-colors duration-[var(--duration-fast)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

/** HistoryPR is the way back to the pull request an archived task opened. */
export function HistoryPR({ pr }: { pr: ArchivedPR | null }) {
  if (pr === null) {
    return null;
  }
  return (
    <button
      type="button"
      // The row underneath opens the task; this one only opens GitHub.
      onClick={(event) => {
        event.stopPropagation();
        void openExternal(pr.url);
      }}
      className="flex items-center gap-0.5 rounded-md tabular-nums transition-colors hover:text-foreground"
    >
      {`#${pr.number}`}
      <ExternalLink aria-hidden="true" className="size-3" />
    </button>
  );
}

/** Empty is the history with nothing in it, or nothing the search found. */
function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

/** TaskRow is an archived task of the list, opening it on click. */
function TaskRow({ task }: { task: ArchivedTask }) {
  const openArchived = useAppStore((state) => state.openArchived);

  return (
    // The row carries the links of the pull request, so it is a div playing a
    // button: a button inside a button is not HTML any browser or screen
    // reader agrees on.
    // biome-ignore lint/a11y/useSemanticElements: a button would hold the buttons of the pull request
    <div
      role="button"
      tabIndex={0}
      onClick={() => openArchived(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          // Space scrolls the page unless the row claims it.
          event.preventDefault();
          openArchived(task.id);
        }
      }}
      className={ROW}
    >
      <span className="min-w-0 truncate font-medium">{task.name}</span>
      <Badge variant="secondary" title={task.repository}>
        {shortName(task.repository)}
      </Badge>
      <span className="min-w-0 flex-1 text-xs text-muted-foreground">
        <HistoryPR pr={task.pr} />
      </span>
      {isOneShot(task) ? (
        <Badge variant="outline" className="shrink-0">
          One-Shot
        </Badge>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">
          {stepCount((task.steps ?? []).length)}
        </span>
      )}
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDates(task.createdAt, task.archivedAt)}
      </span>
    </div>
  );
}

/** ReviewRow is an archived review of the list, opening it on click. */
function ReviewRow({ review }: { review: ArchivedReview }) {
  const openArchivedReview = useAppStore((state) => state.openArchivedReview);

  return (
    <button type="button" onClick={() => openArchivedReview(review.id)} className={ROW}>
      <Badge variant="outline" className="shrink-0">
        Review
      </Badge>
      <span className="min-w-0 truncate font-medium">{`#${review.number} ${review.title}`}</span>
      <Badge variant="secondary" title={review.repository}>
        {shortName(review.repository)}
      </Badge>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{review.author}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{outcomeLabel(review.outcome)}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDates(review.createdAt, review.archivedAt)}
      </span>
    </button>
  );
}

/** DiscussionRow is an archived discussion of the list, opening it on click. */
function DiscussionRow({ discussion }: { discussion: ArchivedDiscussion }) {
  const openArchivedDiscussion = useAppStore((state) => state.openArchivedDiscussion);

  return (
    <button type="button" onClick={() => openArchivedDiscussion(discussion.id)} className={ROW}>
      <Badge variant="outline" className="shrink-0">
        Discussion
      </Badge>
      <span className="min-w-0 truncate font-medium">{discussion.title}</span>
      <Badge variant="secondary">{discussion.board}</Badge>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {`${pluralize(discussion.publishedCount, "card")} published`}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDates(discussion.createdAt, discussion.archivedAt)}
      </span>
    </button>
  );
}

/** HistoryPanel is the list of the tasks, the reviews and the discussions the app has finished. */
export function HistoryPanel() {
  const app = useAppStore((state) => state.app);
  const { historyQuery } = useHistoryUi();
  const setHistoryQuery = useAppStore((state) => state.setHistoryQuery);
  const filter = useRepositoryFilter();
  const filtered = useRepository(filter);

  const olderArchived = useAppStore((state) => state.olderArchived);
  const older = useAppStore((state) => state.olderLists[olderKey("", "")]);
  const olderIds = older?.ids ?? NO_IDS;
  const summary = useHistorySummary();

  // The list shows everything the History holds, so the pages beyond the window are asked one
  // after the other until none is left; a failed page stops the loop.
  useEffect(() => {
    const asking = older === undefined || older.status === "idle";
    const more = older === undefined || older.matched === null || older.next !== null;
    if (asking && more) {
      void loadOlderHistory("", "");
    }
  }, [older]);

  const shown = historyEntries(app, olderArchived, olderIds, historyQuery, filter);
  const empty =
    historyEntries(app, olderArchived, olderIds, "", "").length === 0 &&
    summary.tasks + summary.reviews + summary.discussions === 0;
  const query = historyQuery.trim();

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
      <LocationHeader />
      <div className="min-h-0 flex-1 overflow-auto p-8">
        <div className="flex w-full max-w-[55.5rem] flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Finished tasks, reviews and discussions of every repository, with their documents.
          </p>

          <div className="flex items-center gap-2">
            <Input
              // The panel exists to be searched, so the field is where typing goes.
              autoFocus
              aria-label="Search history"
              placeholder="Search by name, title or #number"
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              className="flex-1"
            />
            <RepositoryFilter className="w-56" />
          </div>

          {empty ? (
            <Empty
              title="Nothing archived yet"
              hint="A task comes here once it's closed, a review once its pull request is merged or closed, a discussion once it's archived."
            />
          ) : shown.length === 0 && query === "" && filtered !== null ? (
            <Empty
              title={`Nothing archived in ${shortName(filtered.fullName)}`}
              hint="Choose another repository, or all of them."
            />
          ) : shown.length === 0 ? (
            <Empty
              title={`Nothing matches “${query}”`}
              hint="Try another name, or clear the search."
            />
          ) : (
            <ul className="flex flex-col">
              {shown.map((entry) => (
                <li key={entry.id}>
                  {entry.kind === "task" ? (
                    <TaskRow task={entry.task} />
                  ) : entry.kind === "review" ? (
                    <ReviewRow review={entry.review} />
                  ) : (
                    <DiscussionRow discussion={entry.discussion} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
