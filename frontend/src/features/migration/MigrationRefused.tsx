import type { ReactNode } from "react";
import { BrandMark } from "@/components/system/BrandMark";
import { CopyButton } from "@/components/system/CopyButton";
import {
  caseHint,
  casesByKind,
  caseTitle,
  caseWhere,
  copyText,
  taskWhere,
} from "@/features/migration/migration-text";
import { displayPaths } from "@/lib/paths";
import type { Migration, MigrationCase, NewerData } from "@/lib/wails";

const META = "text-(length:--text-meta) leading-(--leading-meta)";

/** caseKey tells a case apart from the others of its kind. */
function caseKey(item: MigrationCase): string {
  return `${item.repository}|${(item.tasks ?? []).map((task) => task.name).join(",")}`;
}

export interface MigrationRefusedProps {
  migration: Migration;
}

/** RefusedPage is the page both refusals share: the mark and the title, with what each says under them. */
function RefusedPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="h-dvh overflow-y-auto bg-surface-1 text-ink-1">
      <div className="mx-auto flex w-[round(down,var(--measure-read),1px)] max-w-full flex-col gap-(--space-5) px-(--space-6) pt-(--space-16) pb-(--space-12)">
        <div className="flex items-center gap-(--space-3) text-(length:--text-body) leading-(--leading-body) font-bold">
          <BrandMark size="lg" />
          MySpec
        </div>
        <h1 className="m-0 text-(length:--text-display) leading-(--leading-display) font-semibold text-ink-1">
          {title}
        </h1>
        {children}
      </div>
    </main>
  );
}

/**
 * MigrationRefused takes the whole window when the data could not be opened. Data that could not
 * be updated: it says what is in the way, case by case, and that nothing was changed, and copies
 * the list to take to the previous version. Data from a newer MySpec: it says nothing was read or
 * changed and which versions are at odds. It has no sidebar and no shortcuts.
 */
export function MigrationRefused({ migration }: MigrationRefusedProps) {
  if (migration.newer !== null) {
    return <NewerRefused newer={migration.newer} />;
  }
  const groups = casesByKind(migration);

  return (
    <RefusedPage title="MySpec couldn't be updated">
      <p className="m-0 text-(length:--text-body) leading-(--leading-body) text-ink-2">
        This version keeps every task in a registered repository, one repository per task. Some of
        your tasks can't be carried over, so nothing was changed: your tasks, documents and
        worktrees are as they were, and the previous version still opens them.
      </p>

      {groups.map((group) => (
        <section
          key={group.kind}
          aria-labelledby={`case-${group.kind}`}
          className="flex flex-col gap-(--space-2) rounded-md bg-surface-0 p-(--space-4)"
        >
          <h2
            id={`case-${group.kind}`}
            className="m-0 text-(length:--text-ui) leading-(--leading-ui) font-semibold text-ink-1"
          >
            {caseTitle(group.kind)}
          </h2>
          <p className={`m-0 ${META} text-ink-2`}>{caseHint(group.kind)}</p>
          <ul className="m-0 flex list-none flex-col gap-(--space-2) p-0">
            {group.cases.map((item) => (
              // A case has no identity of its own: the repository and the tasks it names tell it
              // apart from the others of its kind.
              <li
                key={caseKey(item)}
                className="pt-(--space-2) shadow-[inset_0_var(--border)_0_var(--line-1)]"
              >
                <p className={`m-0 font-mono break-all ${META} text-ink-1`}>{caseWhere(item)}</p>
                {item.detail !== "" && (
                  <p className={`m-0 mt-(--space-0-5) ${META} break-words text-ink-3`}>
                    {displayPaths(item.detail)}
                  </p>
                )}
                <ul className="m-0 mt-(--space-1) flex list-none flex-col gap-(--space-0-5) p-0 pl-(--space-4)">
                  {(item.tasks ?? []).map((task) => (
                    <li key={`${task.workspace}/${task.path}/${task.name}`} className={META}>
                      <span className="font-mono text-ink-1">{task.name}</span>
                      <span className="break-all text-ink-3"> · {taskWhere(task)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="m-0 text-(length:--text-body) leading-(--leading-body) text-ink-2">
        Once they're resolved, open this version again and the update runs again.
      </p>
      <div>
        <CopyButton variant="page" label="Copy the list" text={copyText(migration)} />
      </div>
    </RefusedPage>
  );
}

/** NewerRefused is the page of data a newer MySpec changed: this version reads none of it. */
function NewerRefused({ newer }: { newer: NewerData }) {
  return (
    <RefusedPage title="This data is from a newer MySpec">
      <p className="m-0 text-(length:--text-body) leading-(--leading-body) text-ink-2">
        A newer version of MySpec opened your data and changed it in ways this version doesn't know.
        To keep it safe, nothing was read or changed. Open the newer version, or a later one, to
        keep working.
      </p>
      <p
        className={`m-0 rounded-md bg-surface-0 p-(--space-4) font-mono ${META} text-ink-2`}
      >{`Data version ${newer.dataVersion} · this version reads up to ${newer.appVersion}`}</p>
    </RefusedPage>
  );
}
