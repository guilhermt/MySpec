import { type ReactNode, useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { CloseResult } from "@/components/system/CloseResult";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { Tabs, tabId } from "@/components/system/Tabs";
import { Tag } from "@/components/system/Tag";
import { Tooltip } from "@/components/system/Tooltip";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import { Markdown } from "@/features/chat/Markdown";
import { ArchivedBody } from "@/features/history/ArchivedBody";
import { ArchivedDocument } from "@/features/history/ArchivedDocument";
import { ArchivedFacts } from "@/features/history/ArchivedFacts";
import { ArchivedMarkers } from "@/features/history/ArchivedMarkers";
import { ArchivedMenu } from "@/features/history/ArchivedMenu";
import { ArchivedSection } from "@/features/history/ArchivedSection";
import {
  type ArchivedTaskTab,
  archivedTaskFacts,
  archivedTaskTabs,
  prReportsOf,
  reportMarker,
  stepMarkers,
  stepReportsOf,
  stepsOf,
} from "@/features/history/archived";
import { closeLegendTime, closeResultLines } from "@/features/history/close-result";
import { DeleteArchivedTaskDialog } from "@/features/history/DeleteArchivedTaskDialog";
import { historyEntries, historyNeighbor } from "@/features/history/history-list";
import { useArchivedItem } from "@/features/history/useArchivedItem";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { splitFrontMatter } from "@/lib/front-matter";
import { olderKey } from "@/lib/history";
import { isOneShot } from "@/lib/task-modes";
import type { ArchivedTask as ArchivedTaskItem } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { useAppStore, useRepository } from "@/store/app-store";

/** NOTHING is what the place of a document the task doesn't have says. */
const NOTHING = "Nothing was written.";

// REPORT_INDENT is where the reports of a step start: under its title, past the chevron and the
// number (or the icon, in a One-Shot task, which has no number).
const REPORT_INDENT = {
  numbered: "pl-[calc(var(--icon-xs)+var(--key-size)+2*var(--space-2))]",
  plain: "pl-[calc(var(--icon-xs)+var(--icon-sm)+2*var(--space-2))]",
} as const;

// PullRequestDraft is the draft of the pull request in its outlined block: its title, then the text.
function PullRequestDraft({ content }: { content: string }) {
  const { fields, body } = splitFrontMatter(content);
  return (
    <div className="rounded-md px-(--space-5) py-(--space-4) shadow-[inset_0_0_0_var(--border)_var(--line-1)]">
      <p className="text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) text-ink-3 uppercase">
        Pull request draft
      </p>
      {fields.title !== undefined && fields.title !== "" && (
        <h3 className="mt-(--space-1) text-(length:--text-title) leading-(--leading-title) font-semibold text-ink-1">
          {fields.title}
        </h3>
      )}
      <Markdown className="ui-headings">{body}</Markdown>
    </div>
  );
}

// StepList is the steps of the task, each a line that opens the step file and, under it, its reports.
function StepList({ task }: { task: ArchivedTaskItem }) {
  const markers = stepMarkers(task);
  const numbered = !isOneShot(task);
  return (
    <ArchivedMarkers label="Steps of the task">
      {stepsOf(task).map((step, index) => {
        const marker = markers[index];
        return (
          <div key={step.file} className="border-t border-line-1 py-(--space-2) first:border-t-0">
            {marker !== undefined && (
              <MarkerLine view={marker} createdAt="" archived={{ kind: "task", id: task.id }} />
            )}
            <div className={numbered ? REPORT_INDENT.numbered : REPORT_INDENT.plain}>
              {stepReportsOf(step).map((report) => (
                <MarkerLine
                  key={report.file}
                  view={reportMarker(report, `step-reviews/${report.file}`)}
                  createdAt=""
                  archived={{ kind: "task", id: task.id }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </ArchivedMarkers>
  );
}

// Implementation is the single step of a One-Shot task, with its reports.
function Implementation({ task }: { task: ArchivedTaskItem }) {
  if (stepsOf(task).length === 0) {
    return null;
  }
  return (
    <ArchivedSection title="Implementation">
      <StepList task={task} />
    </ArchivedSection>
  );
}

// PullRequestTab is the draft of the pull request and the review of it.
function PullRequestTab({ task }: { task: ArchivedTaskItem }) {
  return (
    <div className="flex flex-col gap-(--space-6)">
      <ArchivedDocument
        taskId={task.id}
        name={task.hasPrDraft ? "pr/draft.md" : null}
        artifactVersion={task.artifactVersion}
        empty="No pull request draft was kept."
        render={(content) => <PullRequestDraft content={content} />}
      />
      <ArchivedSection title="Review of the pull request">
        {prReportsOf(task).length === 0 ? (
          <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
            The pull request had no review pass.
          </p>
        ) : (
          <ArchivedMarkers label="Reviews of the pull request">
            {prReportsOf(task).map((report) => (
              <MarkerLine
                key={report.file}
                view={reportMarker(report, `pr/${report.file}`)}
                createdAt=""
                archived={{ kind: "task", id: task.id }}
              />
            ))}
          </ArchivedMarkers>
        )}
      </ArchivedSection>
    </div>
  );
}

// panelOf is what a tab shows.
function panelOf(task: ArchivedTaskItem, tab: ArchivedTaskTab): ReactNode {
  const document = (name: string, present: boolean) => (
    <ArchivedDocument
      taskId={task.id}
      name={present ? name : null}
      artifactVersion={task.artifactVersion}
      empty={NOTHING}
    />
  );
  switch (tab) {
    case "prd":
      return document("PRD.md", task.hasPrd);
    case "tech_spec":
      return document("tech-spec.md", task.hasTechSpec);
    case "steps":
      return stepsOf(task).length === 0 ? (
        <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">{NOTHING}</p>
      ) : (
        <StepList task={task} />
      );
    case "one_shot":
      return (
        <div className="flex flex-col gap-(--space-6)">
          {document("one-shot.md", task.hasOneShot)}
          <Implementation task={task} />
        </div>
      );
    case "pr":
      return <PullRequestTab task={task} />;
  }
}

export interface ArchivedTaskProps {
  taskId: string;
}

/**
 * ArchivedTask is a finished task as History keeps it: what the closing did, and its documents, steps
 * and pull request read in place. Nothing runs; going back and deleting are what is left.
 */
export function ArchivedTask({ taskId }: ArchivedTaskProps) {
  const task = useArchivedItem("task", taskId);
  const repository = useRepository(task?.repositoryId ?? "");
  const moreRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<ArchivedTaskTab | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [neighbor, setNeighbor] = useState<string | null>(null);
  const panelId = useId();

  if (task === null) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <LocationHeader />
        <ArchivedBody>
          <Skeleton label="Reading the task">
            <SkeletonBar className="w-1/2" />
            <SkeletonBar className="w-full" />
            <SkeletonBar className="w-3/4" />
          </Skeleton>
        </ArchivedBody>
      </section>
    );
  }

  const now = Date.now();
  const oneShot = isOneShot(task);
  const tabs = archivedTaskTabs(task);
  const chosen = tab ?? tabs[0]?.id ?? "pr";
  const { close, pr } = task;

  // The entries History shows, as of the moment the dialog opens: the row that takes the place of this one.
  const openDialog = () => {
    const { app, olderArchived, olderLists, historyQuery } = useAppStore.getState();
    const filter = app?.repositoryFilter ?? "";
    const ids = olderLists[olderKey("", "")]?.ids ?? [];
    setNeighbor(
      historyNeighbor(historyEntries(app, olderArchived, ids, historyQuery, filter), task.id),
    );
    setDeleting(true);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <LocationHeader>
        <Icon icon={oneShot ? ICONS.oneShot : ICONS.task} className="text-ink-3" />
        <Tag>Archived</Tag>
        {oneShot && <Tag>One-Shot</Tag>}
        {pr !== null && (
          <Tooltip content={`Open #${pr.number} on GitHub`}>
            <Button variant="ghost" size="sm" onClick={() => void openExternal(pr.url)}>
              {`PR #${pr.number}`}
              <Icon icon={ICONS.external} size="sm" />
            </Button>
          </Tooltip>
        )}
        <ArchivedMenu tooltip="Delete from History" onDelete={openDialog} triggerRef={moreRef} />
      </LocationHeader>

      <ArchivedBody>
        <ArchivedFacts facts={archivedTaskFacts(task, now)} />

        {close !== null && (
          <CloseResult
            legend="Closing"
            time={closeLegendTime(close, now)}
            label="What the closing did"
            lines={closeResultLines(close, repository?.path ?? null)}
          />
        )}

        <div className="flex flex-col">
          <Tabs
            label="Documents of the task"
            items={tabs.map((item) => ({
              id: item.id,
              label: item.label,
              accessibleName: item.label,
            }))}
            value={chosen}
            onValueChange={setTab}
            controls={panelId}
          />
          <div
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId(panelId, chosen)}
            className="pt-(--space-5)"
          >
            {panelOf(task, chosen)}
          </div>
        </div>
      </ArchivedBody>

      <DeleteArchivedTaskDialog
        task={task}
        neighbor={neighbor}
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) {
            moreRef.current?.focus();
          }
        }}
      />
    </section>
  );
}
