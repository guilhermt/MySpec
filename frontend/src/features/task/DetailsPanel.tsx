import { type ReactNode, useEffect, useRef, useState } from "react";
import { AUX_PANEL_COLUMN_MIN, AuxPanel } from "@/components/system/AuxPanel";
import { ChecksList } from "@/components/system/ChecksList";
import { Chip } from "@/components/system/Chip";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Link } from "@/components/system/Link";
import { PanelRow } from "@/components/system/PanelRow";
import { PanelSection } from "@/components/system/PanelSection";
import { Spinner } from "@/components/system/Spinner";
import { StateGlyph } from "@/components/system/StateGlyph";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { ModelChip } from "@/features/models/ModelChip";
import { StepModeChip } from "@/features/review-mode/StepModeChip";
import {
  type DetailsConversation,
  type DetailsModel,
  type DetailsReport,
  type DetailsStepRow,
  detailsOf,
  reportOf,
} from "@/features/task/details";
import { earlierRowId, leaveEarlierConversation } from "@/features/task/earlier-conversation";
import { ModelsPopover } from "@/features/task/ModelsPopover";
import { PanelDocument } from "@/features/task/PanelDocument";
import { ReviewModePopover } from "@/features/task/ReviewModePopover";
import { screenSession } from "@/features/task/task-session";
import { choiceLabel, choiceOf, type ModelChoice } from "@/lib/models";
import { displayPath } from "@/lib/paths";
import { checkDuration, checkRows, checksSummary, prChecks } from "@/lib/pull-requests";
import { reviewModeLabel } from "@/lib/review-modes";
import { cn } from "@/lib/utils";
import {
  asReviewMode,
  type PullRequest,
  type Step,
  sessionKey,
  type TaskSummary,
} from "@/lib/wails";
import { age, clockTime, fullTime, shortTime, startedTime } from "@/lib/when";
import {
  followTaskReviewMode,
  openExternal,
  readEarlierConversation,
  setStepModel,
  setStepReviewMode,
} from "@/store/actions";
import {
  useAppStore,
  useEarlierConversation,
  useModelCatalog,
  useOpenStepTab,
  useRepository,
} from "@/store/app-store";

/** MINUTE is how often the times of the panel are read again. */
const MINUTE = 60_000;

/** SECOND is how often the checks tell their durations again, while the list is on view. */
const SECOND = 1000;

/** MODE_ICONS are the robot of the agent review and the person of the review by the user. */
const MODE_ICONS = { agent: ICONS.agentMode, manual: ICONS.manualMode } as const;

/** Popover is the popover a chip of the Task group left open. */
type Popover = "reviewMode" | "models";

export interface DetailsPanelProps {
  task: TaskSummary;
}

/**
 * DetailsPanel is what a task has done and the facts of it: its steps, or its implementation, with
 * their conversations and reports, its planning conversations, its pull request with the checks by
 * name, and the task itself, whose review mode and models open their popovers. A report opens in
 * place of the list, with the way back to it; a conversation opens in place of the one of the task.
 */
export function DetailsPanel({ task }: DetailsPanelProps) {
  const openPanel = useAppStore((state) => state.openPanel);
  const asked = useAppStore((state) => state.panelDocument);
  const clearPanelDocument = useAppStore((state) => state.clearPanelDocument);
  const repository = useRepository(task.repositoryId);
  const tab = useOpenStepTab(task.id);
  const now = useNow(MINUTE, true);
  // The file of the report open, the one a marker of the conversation asked for at first.
  const [openFile, setOpenFile] = useState<string | null>(asked);
  // The last report opened is the row the focus returns to on the way back.
  const [lastReport, setLastReport] = useState<string | null>(asked);
  const model = detailsOf(task, repository, screenSession(task, tab)?.stage ?? null);
  // A report the task no longer has falls back to the list.
  const open = openFile === null ? null : reportOf(model, openFile);

  // Open in Details of a marker opens its report, also with the panel already open.
  useEffect(() => {
    if (asked !== null) {
      setOpenFile(asked);
      setLastReport(asked);
      clearPanelDocument();
    }
  }, [asked, clearPanelDocument]);

  const reportRows = (reports: readonly DetailsReport[]) =>
    reports.map((report) => (
      <li key={report.key}>
        <PanelRow
          nested
          glyph={<Icon icon={ICONS.file} size="sm" />}
          onClick={() => {
            setOpenFile(report.file);
            setLastReport(report.file);
          }}
          focusOnMount={report.file === lastReport}
        >
          {report.label}
        </PanelRow>
      </li>
    ));

  const conversationRows = (conversations: readonly DetailsConversation[], nested: boolean) =>
    conversations.map((conversation) => (
      <li key={conversation.stage}>
        <ConversationRow task={task} conversation={conversation} now={now} nested={nested} />
      </li>
    ));

  return (
    <AuxPanel id="details" title="Details" onClose={() => openPanel(null)}>
      <div className="flex flex-col gap-(--space-4) px-(--space-4) pt-(--space-3) pb-(--space-6)">
        {open !== null ? (
          <PanelDocument
            taskId={task.id}
            file={open.file}
            artifactVersion={task.artifactVersion}
            title={open.title}
            back="Details"
            onBack={() => setOpenFile(null)}
          />
        ) : (
          <>
            {model.steps !== null && (
              <PanelSection legend={model.steps.legend}>
                {model.steps.empty !== null && <p className="text-ink-3">{model.steps.empty}</p>}
                <ol className="flex flex-col">
                  {model.steps.rows.map((row) => (
                    <StepRow
                      key={row.kind === "not_started" ? row.step.number : row.number}
                      task={task}
                      row={row}
                      now={now}
                      reports={reportRows}
                      conversations={conversationRows}
                    />
                  ))}
                </ol>
              </PanelSection>
            )}
            {model.implementation !== null && (
              <PanelSection legend="Implementation">
                <ol className="flex flex-col">
                  <StepRow
                    task={task}
                    row={model.implementation}
                    now={now}
                    reports={reportRows}
                    conversations={conversationRows}
                    oneShot
                  />
                </ol>
              </PanelSection>
            )}
            {model.planning.length > 0 && (
              <PanelSection legend="Planning">
                <ul className="flex flex-col">{conversationRows(model.planning, false)}</ul>
              </PanelSection>
            )}
            {model.pullRequest !== null &&
              task.pr !== null &&
              (model.pullRequest.conversations.length > 0 ||
                model.pullRequest.reports.length > 0 ||
                model.pullRequest.pr !== null) && (
                <PanelSection legend="Pull request">
                  {(model.pullRequest.conversations.length > 0 ||
                    model.pullRequest.reports.length > 0) && (
                    // The reports of every pass sit under the PR review conversation, the last row.
                    <ul className="flex flex-col">
                      {conversationRows(model.pullRequest.conversations, false)}
                      {reportRows(model.pullRequest.reports)}
                    </ul>
                  )}
                  {model.pullRequest.pr !== null && (
                    <PullRequestFacts pr={task.pr} facts={model.pullRequest.pr} />
                  )}
                </PanelSection>
              )}
            <TaskFacts task={task} facts={model.task} now={now} />
          </>
        )}
      </div>
    </AuxPanel>
  );
}

interface StepRowProps {
  task: TaskSummary;
  row: DetailsStepRow;
  now: number;
  /** reports draws the rows of the reports under the step. */
  reports: (reports: readonly DetailsReport[]) => ReactNode;
  /** conversations draws the rows of the conversations under a committed step. */
  conversations: (conversations: readonly DetailsConversation[], nested: boolean) => ReactNode;
  /** oneShot names the row Implementation, without a number: the single step of a One-Shot task. */
  oneShot?: boolean;
}

/** StepRow is one step in Details: committed, the current one, or one still to start. */
function StepRow({ task, row, now, reports, conversations, oneShot = false }: StepRowProps) {
  const number = row.kind === "not_started" ? row.step.number : row.number;
  const title = row.kind === "not_started" ? row.step.title : row.title;
  const name = oneShot ? "Implementation" : `${number} · ${title}`;

  if (row.kind === "committed") {
    const time = clockTime(row.committedAt, now);
    const note = [row.subject, fullTime(row.committedAt)].filter((line) => line !== "");
    return (
      <li>
        <PanelRow
          glyph={<Icon icon={ICONS.done} size="sm" />}
          meta={
            <Tooltip content={note}>
              <span>
                <span className="font-mono">{row.sha}</span>
                {time !== "" && ` · ${time}`}
                <span className="sr-only">{` · ${note.join(" · ")}`}</span>
              </span>
            </Tooltip>
          }
        >
          {name}
        </PanelRow>
        {(row.conversations.length > 0 || row.reports.length > 0) && (
          <ul className="flex flex-col">
            {conversations(row.conversations, true)}
            {reports(row.reports)}
          </ul>
        )}
      </li>
    );
  }

  if (row.kind === "current") {
    const mode = <span className="font-medium text-brand-ink">{`now · ${row.mode}`}</span>;
    return (
      <li aria-current="step">
        <PanelRow
          glyph={row.glyph !== null && <StateGlyph state={row.glyph} size="sm" />}
          meta={
            row.fallbackReason === "" ? (
              mode
            ) : (
              <Tooltip content={row.fallbackReason}>
                <span>
                  {mode}
                  <span className="sr-only">{` · ${row.fallbackReason}`}</span>
                </span>
              </Tooltip>
            )
          }
          className="font-semibold"
        >
          {name}
        </PanelRow>
        {row.reports.length > 0 && <ul className="flex flex-col">{reports(row.reports)}</ul>}
      </li>
    );
  }

  return (
    <li>
      <PanelRow
        glyph={<StateGlyph state="todo" size="sm" />}
        meta={<StepChoosers task={task} step={row.step} />}
        className="text-ink-3"
      >
        {name}
      </PanelRow>
    </li>
  );
}

interface ConversationRowProps {
  task: TaskSummary;
  conversation: DetailsConversation;
  now: number;
  /** nested is a conversation under a step, past its glyph. */
  nested: boolean;
}

/**
 * ConversationRow is a conversation the task has had, with the time it started. The one on screen
 * says now and opens nothing; any other opens in place of it, once it is read, and a second click
 * brings back the one of the task. While it is read the row says so, and a failure stays on the row,
 * where a click reads it again.
 */
function ConversationRow({ task, conversation, now, nested }: ConversationRowProps) {
  const { stage } = conversation;
  const earlier = useEarlierConversation(task.id);
  const status = useAppStore(
    (state) => state.transcripts[sessionKey(task.id, stage)]?.status ?? null,
  );
  const openEarlierConversation = useAppStore((state) => state.openEarlierConversation);
  const openPanel = useAppStore((state) => state.openPanel);
  // asked is the reading this row started, and whether the panel covered the conversation then.
  const [asked, setAsked] = useState<{ covering: boolean } | null>(null);

  // The conversation takes the place of the one of the task only once it is read; a panel that
  // covers it closes then, so the way back is on view.
  useEffect(() => {
    if (asked === null || status !== "ready") {
      return;
    }
    setAsked(null);
    openEarlierConversation(task.id, stage, !asked.covering);
    if (asked.covering) {
      openPanel(null);
    }
  }, [asked, status, task.id, stage, openEarlierConversation, openPanel]);

  if (conversation.now) {
    return (
      <PanelRow
        nested={nested}
        glyph={<Icon icon={ICONS.conversation} size="sm" />}
        meta={<span className="font-medium text-brand-ink">now</span>}
      >
        {conversation.label}
      </PanelRow>
    );
  }

  const reading = earlier?.stage === stage;
  const loading = asked !== null && status === "loading";
  const failed = asked !== null && status === "error";
  const time = shortTime(conversation.startedAt, now);

  const open = () => {
    if (reading) {
      // A second click on the row that opened it keeps the focus there, whichever panel it opened from.
      leaveEarlierConversation(document.getElementById(earlierRowId(stage)));
      return;
    }
    // The panel covers the conversation below the width from which it stands beside it.
    const width = document.querySelector<HTMLElement>(".main-area")?.clientWidth ?? 0;
    setAsked({ covering: width < AUX_PANEL_COLUMN_MIN });
    void readEarlierConversation(task.id, stage);
  };

  return (
    <PanelRow
      id={earlierRowId(stage)}
      nested={nested}
      pressed={reading}
      busy={loading}
      onClick={open}
      glyph={
        loading ? (
          <Spinner tone="current" />
        ) : failed ? (
          <StateGlyph state="error" size="sm" />
        ) : (
          <Icon icon={ICONS.conversation} size="sm" />
        )
      }
      {...(loading || failed || time === ""
        ? {}
        : { meta: time, label: `${conversation.label} · ${time}` })}
      {...(failed ? { className: "text-state-error" } : {})}
    >
      {loading
        ? "Opening the conversation…"
        : failed
          ? "Couldn't open it · Try again"
          : conversation.label}
    </PanelRow>
  );
}

/**
 * StepChoosers are the review mode and the model of a step not started: chips while the step can
 * still take them, the text of what it has otherwise.
 */
function StepChoosers({ task, step }: { task: TaskSummary; step: Step }) {
  const catalog = useModelCatalog();
  const [saving, setSaving] = useState(false);
  const mode = asReviewMode(step.reviewMode);
  const implementation = choiceLabel(catalog, choiceOf(task.models ?? [], "implementation"));

  const changeModel = async (choice: ModelChoice) => {
    setSaving(true);
    try {
      await setStepModel(task.id, step.number, choice);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {step.reviewModeEditable ? (
        <StepModeChip
          step={step}
          taskMode={asReviewMode(task.reviewMode)}
          onChange={(next) => void setStepReviewMode(task.id, step.number, next)}
          onFollow={() => void followTaskReviewMode(task.id, step.number)}
        />
      ) : (
        <span>{reviewModeLabel(mode)}</span>
      )}
      {step.modelEditable ? (
        <ModelChip
          value={step}
          onChange={(choice) => void changeModel(choice)}
          label={`Step ${step.number}`}
          own={step.adjusted}
          followNote={
            step.adjusted
              ? `Its own model · Implementation uses ${implementation}`
              : "Follows Implementation"
          }
          saving={saving}
          size="sm"
        />
      ) : (
        <span>{choiceLabel(catalog, step)}</span>
      )}
    </>
  );
}

/** Fact is one key and its value in a list of facts. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 text-ink-1 wrap-anywhere">{children}</dd>
    </>
  );
}

/** FACTS is a list of keys and values: the key in its column, the value beside it. */
const FACTS =
  "grid grid-cols-[minmax(0,var(--col-keys))_minmax(0,1fr)] items-baseline gap-x-(--space-3) gap-y-(--space-1-5)";

/** ExternalLink is a link that opens in the browser, since nothing navigates inside the webview. */
function ExternalLink({ url, children }: { url: string; children: ReactNode }) {
  return (
    <Link
      href={url}
      external
      onClick={(event) => {
        event.preventDefault();
        void openExternal(url);
      }}
    >
      {children}
    </Link>
  );
}

interface PullRequestFactsProps {
  pr: PullRequest;
  facts: NonNullable<NonNullable<DetailsModel["pullRequest"]>["pr"]>;
}

/**
 * PullRequestFacts is the open pull request: its number and its base, the checks by name, and when
 * GitHub was read. It is on screen only with the panel open, and only then do the durations of the
 * checks that run count the seconds.
 */
function PullRequestFacts({ pr, facts }: PullRequestFactsProps) {
  const now = useNow(SECOND, true);
  const rows = checkRows(prChecks(pr)).map((row) => ({
    ...row,
    duration: checkDuration(row, now),
  }));
  const ended = facts.state === "merged" || facts.state === "closed" ? ` · ${facts.state}` : "";

  return (
    <dl className={cn(FACTS, "pt-(--space-2)")}>
      <Fact label="Pull request">
        <ExternalLink url={facts.url}>{`#${facts.number}`}</ExternalLink>
        {` · into ${facts.base}${ended}`}
      </Fact>
      <Fact label="Checks">
        <ChecksList
          summary={checksSummary(prChecks(pr))}
          rows={rows}
          onOpen={(url) => void openExternal(url)}
        />
      </Fact>
      {pr.checkedAt !== "" && (
        <Fact label="Checked">
          <Tooltip content={fullTime(pr.checkedAt)}>
            <span>{age(pr.checkedAt, now)}</span>
          </Tooltip>
        </Fact>
      )}
    </dl>
  );
}

interface TaskFactsProps {
  task: TaskSummary;
  facts: DetailsModel["task"];
  now: number;
}

/** TaskFacts is the Task group: where the task lives, how it runs, and when it started. */
function TaskFacts({ task, facts, now }: TaskFactsProps) {
  const reviewModeRef = useRef<HTMLButtonElement>(null);
  const modelsRef = useRef<HTMLButtonElement>(null);
  const [popover, setPopover] = useState<Popover | null>(null);
  const close = (open: boolean) => {
    if (!open) {
      setPopover(null);
    }
  };
  const path = displayPath(facts.path);

  return (
    <PanelSection legend="Task">
      <dl className={FACTS}>
        <Fact label="Repository">
          {facts.repository}
          {path !== "" &&
            (facts.cloneMissing ? (
              <>
                {" · "}
                <Tooltip content={path}>
                  <span className="text-state-notice">
                    <span aria-hidden="true">◇ </span>
                    clone missing
                    <span className="sr-only">{` · ${path}`}</span>
                  </span>
                </Tooltip>
              </>
            ) : (
              <>
                {" · "}
                <span className="font-mono">{path}</span>
              </>
            ))}
        </Fact>
        {facts.card !== null && (
          <Fact label="Card">
            <ExternalLink url={facts.card.url}>
              {`${facts.card.repository}#${facts.card.number}`}
            </ExternalLink>
            {facts.card.status !== "" && ` · ${facts.card.status}`}
          </Fact>
        )}
        {facts.epic !== null && (
          <Fact label="Epic">
            <ExternalLink url={facts.epic.url}>{facts.epic.title}</ExternalLink>
          </Fact>
        )}
        <Fact label="Mode">{facts.mode}</Fact>
        <Fact label="Review mode">
          <Chip
            ref={reviewModeRef}
            kind="menu"
            size="sm"
            aria-label={`Review mode of the task: ${reviewModeLabel(facts.reviewMode)}`}
            aria-haspopup="dialog"
            aria-expanded={popover === "reviewMode"}
            onClick={() => setPopover("reviewMode")}
          >
            <Icon icon={MODE_ICONS[facts.reviewMode]} size="xs" />
            {reviewModeLabel(facts.reviewMode)}
          </Chip>
        </Fact>
        <Fact label="Models">
          <Chip
            ref={modelsRef}
            kind="menu"
            size="sm"
            aria-label="Models per stage"
            aria-haspopup="dialog"
            aria-expanded={popover === "models"}
            onClick={() => setPopover("models")}
          >
            Per stage
          </Chip>
        </Fact>
        {facts.worktree !== "" && (
          <>
            <Fact label="Branch">
              <span className="font-mono">{facts.branch}</span>
            </Fact>
            <Fact label="Base">
              <span className="font-mono">{facts.base}</span>
            </Fact>
            <Fact label="Worktree">
              <span className="font-mono">{displayPath(facts.worktree)}</span>
            </Fact>
          </>
        )}
        <Fact label="Started">
          <Tooltip content={fullTime(facts.startedAt)}>
            <span>{startedTime(facts.startedAt, now)}</span>
          </Tooltip>
        </Fact>
      </dl>
      <ReviewModePopover
        task={task}
        open={popover === "reviewMode"}
        onOpenChange={close}
        anchor={reviewModeRef}
      />
      <ModelsPopover
        task={task}
        open={popover === "models"}
        onOpenChange={close}
        anchor={modelsRef}
      />
    </PanelSection>
  );
}
