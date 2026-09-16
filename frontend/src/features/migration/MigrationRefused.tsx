import { caseHint, casesByKind, caseTitle } from "@/features/migration/migration-text";
import { AppMark } from "@/features/welcome/WelcomeScreen";
import type { Migration, MigrationCase } from "@/lib/wails";

/** caseKey tells a case apart from the others of its kind. */
function caseKey(item: MigrationCase): string {
  return `${item.repository}|${(item.tasks ?? []).map((task) => task.name).join(",")}`;
}

export interface MigrationRefusedProps {
  migration: Migration;
}

/**
 * MigrationRefused takes the whole app when the data could not be updated: it
 * says what is in the way, case by case, and that nothing was changed.
 */
export function MigrationRefused({ migration }: MigrationRefusedProps) {
  const groups = casesByKind(migration);

  // The list of cases can be taller than the window: the scrolling is the main,
  // and the centering an inner box at least as tall as it, so a long list
  // starts at the top instead of overflowing above it.
  return (
    <main className="h-dvh overflow-y-auto bg-background px-6 py-8 text-foreground">
      <div className="flex min-h-full items-center justify-center">
        <div className="flex w-full max-w-[43rem] flex-col gap-8">
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <AppMark />
              <h1 className="text-[2.125rem] font-semibold leading-none">
                MySpec couldn't be updated
              </h1>
            </div>
            <p className="text-muted-foreground">
              This version keeps every task in a registered repository, one repository per task.
              Some of your tasks can't be carried over, so nothing was changed: your tasks,
              documents and worktrees are as they were, and the previous version still opens them.
            </p>
          </header>

          {groups.map((group) => (
            <section key={group.kind} className="flex flex-col gap-2">
              <h2 className="font-semibold">{caseTitle(group.kind)}</h2>
              <p className="text-sm text-muted-foreground">{caseHint(group.kind)}</p>
              <ul className="flex flex-col divide-y rounded-lg border">
                {group.cases.map((item) => (
                  // A case has no identity of its own: the repository and the
                  // tasks it names tell it apart from the others of its kind.
                  <li key={caseKey(item)} className="flex flex-col gap-1 px-4 py-3">
                    {item.repository !== "" && (
                      <p className="break-all font-mono text-sm">{item.repository}</p>
                    )}
                    {item.detail !== "" && <p className="text-sm">{item.detail}</p>}
                    <ul className="flex flex-col gap-1">
                      {(item.tasks ?? []).map((task) => (
                        <li key={`${task.workspace}/${task.path}/${task.name}`}>
                          <p className="text-sm font-medium">{task.name}</p>
                          <p className="break-all text-xs text-muted-foreground">
                            {task.path === "" ? task.workspace : `${task.workspace} · ${task.path}`}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="text-sm text-muted-foreground">
            Once they're resolved, open this version again and the update runs again.
          </p>
        </div>
      </div>
    </main>
  );
}
