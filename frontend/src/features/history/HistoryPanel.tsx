import { Archive, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDates, stepCount } from "@/features/history/history-format";
import { historyEntries } from "@/features/history/history-list";
import { outcomeLabel } from "@/features/reviews/review-status";
import { RepositoryFilter } from "@/features/sidebar/RepositoryFilter";
import { shortName } from "@/lib/repositories";
import { isOneShot } from "@/lib/task-modes";
import type { ArchivedPR, ArchivedReview, ArchivedTask } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { useAppStore, useHistoryUi, useRepository, useRepositoryFilter } from "@/store/app-store";

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

/** HistoryPanel is the list of the tasks and the reviews the app has finished. */
export function HistoryPanel() {
  const app = useAppStore((state) => state.app);
  const { historyQuery } = useHistoryUi();
  const setHistoryQuery = useAppStore((state) => state.setHistoryQuery);
  const filter = useRepositoryFilter();
  const filtered = useRepository(filter);

  const shown = historyEntries(app, historyQuery, filter);
  const empty = historyEntries(app, "", "").length === 0;
  const query = historyQuery.trim();

  return (
    <main className="h-dvh overflow-auto bg-background p-8 text-foreground">
      <div className="flex w-full max-w-[55.5rem] flex-col gap-4">
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Archive aria-hidden="true" className="size-6 shrink-0 text-muted-foreground" />
            <h1 className="text-[1.5rem] font-semibold">History</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Finished tasks and reviews of every repository, with their documents.
          </p>
        </header>

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
          <RepositoryFilter variant="field" className="w-56" />
        </div>

        {empty ? (
          <Empty
            title="Nothing archived yet"
            hint="A task comes here once it's closed, a review once its pull request is merged or closed."
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
                ) : (
                  <ReviewRow review={entry.review} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
