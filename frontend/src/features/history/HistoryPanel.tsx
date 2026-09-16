import { Archive, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDates, stepCount } from "@/features/history/history-format";
import { RepositoryFilter } from "@/features/sidebar/RepositoryFilter";
import { shortName } from "@/lib/repositories";
import { isOneShot } from "@/lib/task-modes";
import type { ArchivedPR } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import {
  filterHistory,
  useAppStore,
  useHistory,
  useHistoryUi,
  useRepository,
  useRepositoryFilter,
} from "@/store/app-store";

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

/** HistoryPanel is the list of the tasks the app has finished. */
export function HistoryPanel() {
  const history = useHistory();
  const { historyQuery } = useHistoryUi();
  const setHistoryQuery = useAppStore((state) => state.setHistoryQuery);
  const openArchived = useAppStore((state) => state.openArchived);
  const filter = useRepositoryFilter();
  const filtered = useRepository(filter);

  const shown = filterHistory(history, historyQuery, filter);
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
            Finished tasks of every repository, with their documents.
          </p>
        </header>

        <div className="flex items-center gap-2">
          <Input
            // The panel exists to be searched, so the field is where typing goes.
            autoFocus
            aria-label="Search history"
            placeholder="Search by name"
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            className="flex-1"
          />
          <RepositoryFilter variant="field" className="w-56" />
        </div>

        {history.length === 0 ? (
          <Empty title="Nothing archived yet" hint="A task comes here once it's closed." />
        ) : shown.length === 0 && query === "" && filtered !== null ? (
          <Empty
            title={`No archived tasks in ${shortName(filtered.fullName)}`}
            hint="Choose another repository, or all of them."
          />
        ) : shown.length === 0 ? (
          <Empty
            title={`No task matches “${query}”`}
            hint="Try another name, or clear the search."
          />
        ) : (
          <ul className="flex flex-col">
            {shown.map((task) => (
              <li key={task.id}>
                {/* The row carries the links of the pull request, so it is a
                    div playing a button: a button inside a button is not HTML
                    any browser or screen reader agrees on. */}
                {/* biome-ignore lint/a11y/useSemanticElements: a button would hold the buttons of the pull request */}
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
