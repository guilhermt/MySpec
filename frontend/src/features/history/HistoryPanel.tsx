import { Archive, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDates, stepCount } from "@/features/history/history-format";
import { findNode } from "@/features/tree/tree-model";
import { repoName } from "@/lib/repos";
import { isOneShot } from "@/lib/task-modes";
import type { ArchivedRepo, ArchivedTask, State } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import {
  filterHistory,
  repoNodeId,
  useAppStore,
  useHistory,
  useHistoryUi,
} from "@/store/app-store";

const ROW =
  "flex h-10 w-full items-center gap-2 rounded-md px-2 text-left outline-none transition-colors duration-[var(--duration-fast)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

/** originLabel names where a task lived: the workspace root or one repository. */
function originLabel(app: State | null, task: ArchivedTask): string {
  if (task.repoPath === "") {
    return "Root";
  }
  return app === null ? task.repoPath : (findNode(app, repoNodeId(task.repoPath))?.label ?? "");
}

/**
 * HistoryRepos names the repositories an archived task touched, each with a way
 * back to its pull request on GitHub.
 */
export function HistoryRepos({ repos }: { repos: readonly ArchivedRepo[] }) {
  const app = useAppStore((state) => state.app);

  return (
    <span className="flex min-w-0 items-center gap-2">
      {repos.map((repo) => (
        <span key={repo.repoPath} className="flex items-center gap-1">
          <span className="min-w-0 truncate">{repoName(app, repo)}</span>
          {repo.prNumber > 0 && (
            <button
              type="button"
              // The row underneath opens the task; this one only opens GitHub.
              onClick={(event) => {
                event.stopPropagation();
                void openExternal(repo.prUrl);
              }}
              className="flex items-center gap-0.5 rounded-md tabular-nums transition-colors hover:text-foreground"
            >
              {`#${repo.prNumber}`}
              <ExternalLink aria-hidden="true" className="size-3" />
            </button>
          )}
        </span>
      ))}
    </span>
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

/** HistoryPanel is the list of the tasks this workspace has finished. */
export function HistoryPanel() {
  const app = useAppStore((state) => state.app);
  const history = useHistory();
  const { historyQuery } = useHistoryUi();
  const setHistoryQuery = useAppStore((state) => state.setHistoryQuery);
  const openArchived = useAppStore((state) => state.openArchived);

  const shown = filterHistory(history, historyQuery);

  return (
    <main className="h-dvh overflow-auto bg-background p-8 text-foreground">
      <div className="flex w-full max-w-[55.5rem] flex-col gap-4">
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Archive aria-hidden="true" className="size-6 shrink-0 text-muted-foreground" />
            <h1 className="text-[1.5rem] font-semibold">History</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Finished tasks of this workspace, with their documents.
          </p>
        </header>

        <Input
          // The panel exists to be searched, so the field is where typing goes.
          autoFocus
          aria-label="Search history"
          placeholder="Search by name"
          value={historyQuery}
          onChange={(event) => setHistoryQuery(event.target.value)}
        />

        {history.length === 0 ? (
          <Empty
            title="Nothing archived yet"
            hint="A task comes here when its last repository is closed."
          />
        ) : shown.length === 0 ? (
          <Empty
            title={`No task matches “${historyQuery.trim()}”`}
            hint="Try another name, or clear the search."
          />
        ) : (
          <ul className="flex flex-col">
            {shown.map((task) => (
              <li key={task.id}>
                {/* The row carries the links of the pull requests, so it is a
                    div playing a button: a button inside a button is not HTML
                    any browser or screen reader agrees on. */}
                {/* biome-ignore lint/a11y/useSemanticElements: a button would hold the buttons of the pull requests */}
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
                  <Badge variant="secondary">{originLabel(app, task)}</Badge>
                  <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                    <HistoryRepos repos={task.repos ?? []} />
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
