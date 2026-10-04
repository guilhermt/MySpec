import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { ChecksList } from "@/components/system/ChecksList";
import { CutText } from "@/components/system/CutText";
import { Finding } from "@/components/system/Finding";
import { DraftGlyph } from "@/components/system/FoldedDraft";
import { Icon } from "@/components/system/Icon";
import { ICONS, type IconMeaning } from "@/components/system/icons";
import { Link } from "@/components/system/Link";
import { Shimmer } from "@/components/system/Shimmer";
import { StateGlyph } from "@/components/system/StateGlyph";
import { Tooltip } from "@/components/system/Tooltip";
import type { DraftRowView } from "@/features/chat/discussion-markers";
import { Chevron } from "@/features/chat/entries/Chevron";
import { Markdown } from "@/features/chat/Markdown";
import type { MarkerIcon, MarkerView } from "@/features/chat/markers";
import { contextCharacters } from "@/features/discussion/new-discussion";
import { useDiscussionArtifact } from "@/features/discussion/useDiscussionArtifact";
import { useReviewArtifact } from "@/features/reviews/useReviewArtifact";
import { useArtifact } from "@/features/task/useArtifact";
import { splitFrontMatter } from "@/lib/front-matter";
import { checkDuration, checkRows } from "@/lib/pull-requests";
import { cn } from "@/lib/utils";
import type { PlanProblem, ReviewSummary, TaskSummary } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { openExternal, openFindingInEditor, openPRFindingInEditor } from "@/store/actions";
import { type PanelId, useAppStore } from "@/store/app-store";

/** MARKER_ICONS is the meaning of ICONS each icon of a line draws: the product's message is its mark. */
const MARKER_ICONS: Record<MarkerIcon, IconMeaning> = {
  file: "file",
  start: "start",
  product: "mark",
  commit: "commit",
  pullRequest: "pullRequest",
  checks: "checks",
  compact: "compact",
  pause: "pause",
  retry: "retry",
  check: "done",
  problem: "problem",
  ban: "ban",
  merge: "merge",
};

/** FOOTS are the ways from a document read in place to the panel that holds it. */
const FOOTS: Record<"artifacts" | "details" | "reports", { panel: PanelId; label: string }> = {
  artifacts: { panel: "artifacts", label: "Open in Artifacts" },
  details: { panel: "details", label: "Open in Details" },
  reports: { panel: "reports", label: "Open in Reports" },
};

// LINE is the one line of a marker: the text on the edge of the column, the veil of the hover
// bleeding --space-2 past it.
const LINE =
  "-mx-(--space-2) flex min-h-(--size-control-sm) min-w-0 items-center gap-(--space-2) rounded-sm px-(--space-2) text-left text-(length:--text-meta) leading-(--leading-meta) text-ink-3";

// ERROR_RAIL is the rail of an error on the edge of a line.
const ERROR_RAIL = "shadow-[inset_var(--error-rail)_0_0_var(--state-error)]";

// SUNKEN is the block a marker opens into, in the width of the column.
const SUNKEN =
  "mt-(--space-1) rounded-md bg-surface-0 px-(--space-4) py-(--space-3) shadow-[inset_0_0_0_var(--border)_var(--line-1)]";

function ProblemsBody({ problems }: { problems: readonly PlanProblem[] }) {
  return (
    <ul data-slot="marker-body" className={cn(SUNKEN, "flex flex-col gap-(--space-2) select-text")}>
      {problems.map((problem) => (
        <li
          key={`${problem.file}:${problem.message}`}
          className="text-(length:--text-body) leading-(--leading-body) break-words text-ink-1"
        >
          {problem.file !== "" && (
            <>
              <span className="font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-3 [font-variant-ligatures:none]">
                {problem.file}
              </span>
              {" · "}
            </>
          )}
          {problem.message}
        </li>
      ))}
    </ul>
  );
}

function ChecksBody({ body }: { body: Extract<MarkerView["body"], { kind: "checks" }> }) {
  const now = Date.now();
  const rows = checkRows(body.reading).map((row) => ({
    ...row,
    duration: checkDuration(row, now),
  }));
  return (
    <div data-slot="marker-body" className={SUNKEN}>
      <ChecksList summary={body.summary} rows={rows} onOpen={(url) => void openExternal(url)} />
    </div>
  );
}

/** FindingsBody is the findings of a pass in the sunken block a marker opens into; History draws it too. */
export function FindingsBody({
  body,
  review,
  task,
}: {
  body: Extract<MarkerView["body"], { kind: "findings" }>;
  review: ReviewSummary | null;
  task: TaskSummary | null;
}) {
  return (
    <ul data-slot="marker-body" className={cn(SUNKEN, "flex flex-col gap-(--space-2)")}>
      {body.findings.map((finding) => (
        <li key={finding.id}>
          <Finding
            model={finding}
            current={false}
            onOpenLine={() => {
              if (finding.location.kind === "anchored") {
                void openExternal(finding.location.url);
              }
            }}
            onOpenEditor={() => {
              if (review !== null) {
                void openFindingInEditor(review.id, body.pass, finding.number);
              } else if (task !== null) {
                void openPRFindingInEditor(task.id, body.pass, finding.number);
              }
            }}
            renderText={(text) => <Markdown cutCode>{text}</Markdown>}
          />
        </li>
      ))}
    </ul>
  );
}

// StatusText is the state of a row of a list of drafts, its issue on GitHub as the link inside it:
// "Created web#470".
function StatusText({ row }: { row: DraftRowView }) {
  const { link } = row;
  const at = link === null ? -1 : row.status.indexOf(link.label);
  if (link === null || at === -1) {
    return row.status;
  }
  return (
    <>
      {row.status.slice(0, at)}
      <Link
        href={link.url}
        external
        onClick={(event) => {
          event.preventDefault();
          void openExternal(link.url);
        }}
      >
        {link.label}
      </Link>
      {row.status.slice(at + link.label.length)}
    </>
  );
}

function DraftsBody({ rows }: { rows: readonly DraftRowView[] }) {
  return (
    <ul data-slot="marker-body" className={cn(SUNKEN, "flex flex-col gap-(--space-2)")}>
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex min-w-0 items-center gap-(--space-2) text-(length:--text-body) leading-(--leading-body) text-ink-1"
        >
          <DraftGlyph glyph={row.glyph} spacer />
          {row.prefix !== "" && <span className="shrink-0 text-ink-3">{row.prefix}</span>}
          <Tooltip content={row.title}>
            <span className="min-w-0 truncate">{row.title}</span>
          </Tooltip>
          <CutText
            text={row.status}
            className={cn(
              "ml-auto max-w-1/2 shrink-0 text-(length:--text-meta) leading-(--leading-meta)",
              row.tone === "error"
                ? "text-state-error"
                : row.tone === "quiet"
                  ? "text-ink-3"
                  : "text-ink-2",
            )}
          >
            <StatusText row={row} />
          </CutText>
        </li>
      ))}
    </ul>
  );
}

function CommitsBody({ body }: { body: Extract<MarkerView["body"], { kind: "commits" }> }) {
  return (
    <ul
      data-slot="marker-body"
      className={cn(
        SUNKEN,
        "flex flex-col gap-(--space-1) font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-2 select-text [font-variant-ligatures:none]",
      )}
    >
      {body.commits.map((commit) => (
        <li key={commit.sha} className="break-words">
          {`${commit.sha} ${commit.subject}`}
        </li>
      ))}
      {body.more > 0 && <li className="text-ink-3">{`and ${body.more} more`}</li>}
    </ul>
  );
}

// documentText is what a document reads in place: a step file without its metadata header.
function documentText(name: string, content: string): string {
  return name.startsWith("steps/") ? splitFrontMatter(content).body : content;
}

export interface MarkerLineProps {
  view: MarkerView;
  /** createdAt is when it happened: on hover and focus, and always in the name; "" for none. */
  createdAt: string;
  /** task is the task whose documents an artifact body reads; null outside a task, where none opens. */
  task?: TaskSummary | null;
  /** review is the review whose documents an artifact body reads; null outside a review. */
  review?: ReviewSummary | null;
  /** discussion is the discussion whose documents a body of it reads; null outside one. */
  discussion?: { id: string; documentRevision: number; documents: boolean } | null;
  /** archived is the archived task or review whose documents an artifact body reads, with no way on to a panel: History has none. */
  archived?: { kind: "task" | "review"; id: string } | null;
  /** requested opens the line and gives it the focus, once: the request bar asked for it. */
  requested?: boolean;
  /** onRequested says the request was settled. */
  onRequested?: () => void;
}

/**
 * MarkerLine is an event of the conversation in one line: a start, a message of the product, a
 * document written, a commit. What has content opens it in place, a document read on opening with
 * the way to its panel at the foot; the rest is read, with no stop on the keyboard path.
 */
export function MarkerLine({
  view,
  createdAt,
  task = null,
  review = null,
  discussion = null,
  archived = null,
  requested = false,
  onRequested,
}: MarkerLineProps) {
  const [open, setOpen] = useState(false);
  // A new attempt reads the document again, as a new version on disk does.
  const [attempt, setAttempt] = useState(0);
  const id = useId();
  const articleRef = useRef<HTMLElement>(null);
  // toggleRef is the line that opens: the stop of the walk, which keeps the focus.
  const toggleRef = useRef<HTMLButtonElement>(null);
  const openPanelAt = useAppStore((state) => state.openPanelAt);
  const { body } = view;
  const opens = body.kind !== "none";
  // An archived task keeps its documents as they are: the version stays 0 and only a new attempt reads again.
  const taskId = task?.id ?? (archived?.kind === "task" ? archived.id : null);
  const taskArtifact = useArtifact(
    taskId ?? "",
    open && body.kind === "artifact" && taskId !== null ? body.name : null,
    (task?.artifactVersion ?? 0) + attempt,
  );
  // The report of a pass is read again when the agent writes it again, which is its revision.
  const passRevision =
    body.kind === "artifact"
      ? ((review?.passes ?? []).find((pass) => pass.file === body.name)?.revision ?? 0)
      : 0;
  const reviewId = review?.id ?? (archived?.kind === "review" ? archived.id : null);
  const reviewArtifact = useReviewArtifact(
    reviewId ?? "",
    open && body.kind === "artifact" && reviewId !== null ? body.name : null,
    passRevision + attempt,
  );
  const discussionDocument = body.kind === "discussionDocument" ? body : null;
  const discussionArtifact = useDiscussionArtifact(
    discussion?.id ?? "",
    open && discussionDocument !== null && discussionDocument.text === null && discussion !== null
      ? discussionDocument.name
      : null,
    discussion?.documentRevision ?? 0,
    attempt,
  );
  const artifact = reviewId === null ? taskArtifact : reviewArtifact;
  const time = view.timeText ?? clockTime(createdAt, Date.now());
  const lead = view.lead === undefined ? view.text : `${view.lead} ${view.text}`;
  const said = view.complement === "" ? lead : `${lead} · ${view.complement}`;
  const named = view.aside === undefined ? said : `${said}, ${view.aside}`;
  const name = time === "" ? named : `${named}, ${time}`;

  useEffect(() => {
    if (!requested) {
      return;
    }
    if (opens) {
      setOpen(true);
      toggleRef.current?.focus();
    }
    articleRef.current?.scrollIntoView?.({ block: "nearest" });
    onRequested?.();
  }, [requested, opens, onRequested]);

  // An error draws the rail of an error on the edge of its line.
  const railOf = view.tone === "error" ? ERROR_RAIL : "";
  const reading =
    (body.kind === "artifact" && artifact.status === "loading") ||
    (discussionDocument?.text === null && discussionArtifact.status === "loading");
  const cells = (
    <>
      {opens ? <Chevron open={open} /> : <span aria-hidden="true" className="w-(--icon-xs)" />}
      {view.lead !== undefined ? (
        <span
          aria-hidden="true"
          className="w-(--key-size) shrink-0 text-right font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-3 tabular-nums"
        >
          {view.lead}
        </span>
      ) : view.tone === "error" ? (
        <StateGlyph state="error" size="sm" />
      ) : (
        <Icon
          icon={ICONS[MARKER_ICONS[view.icon]]}
          size="sm"
          className={view.icon === "retry" ? "text-ink-3" : "text-ink-4"}
        />
      )}
      <span
        className={cn(
          "shrink-0 whitespace-nowrap text-ink-2",
          view.icon === "product" ? "font-normal" : "font-medium",
        )}
      >
        {reading ? <Shimmer>{view.text}</Shimmer> : view.text}
      </span>
      {view.complement !== "" && <CutText text={view.complement} className="text-ink-3" />}
      {/* The link is an action of its own: a line that opens is a button, which holds no other. */}
      {view.link !== undefined && !opens && (
        <Button
          variant="ghost"
          size="xs"
          icon={ICONS.external}
          className="ml-auto shrink-0"
          onClick={() => void openExternal(view.link?.url ?? "")}
        >
          {view.link.label}
        </Button>
      )}
      {view.aside !== undefined && (
        <span
          aria-hidden="true"
          className="ml-auto shrink-0 font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-3 [font-variant-ligatures:none]"
        >
          {view.aside}
        </span>
      )}
      {!view.timeHidden && (
        <span
          className={cn(
            "entry-time shrink-0 text-(length:--text-micro) leading-(--leading-micro) text-ink-4 tabular-nums",
            (view.link === undefined || opens) && view.aside === undefined ? "ml-auto" : "",
          )}
        >
          {time}
        </span>
      )}
    </>
  );

  if (!opens) {
    return (
      <article ref={articleRef} aria-label={name} className="flex flex-col">
        <div className={cn(LINE, railOf)}>{cells}</div>
      </article>
    );
  }

  let content: ReactNode = null;
  switch (body.kind) {
    case "markdown":
      content = (
        <div data-slot="marker-body" className={cn(SUNKEN, "select-text")}>
          <Markdown cutCode>{body.text}</Markdown>
        </div>
      );
      break;
    case "problems":
      content = <ProblemsBody problems={body.problems} />;
      break;
    case "checks":
      content = <ChecksBody body={body} />;
      break;
    case "findings":
      content = <FindingsBody body={body} review={review ?? null} task={task} />;
      break;
    case "commits":
      content = <CommitsBody body={body} />;
      break;
    case "drafts":
      content = <DraftsBody rows={body.rows} />;
      break;
    case "discussionDocument": {
      const text =
        body.text ?? (discussionArtifact.status === "ready" ? discussionArtifact.content : null);
      content =
        body.text === null && discussionArtifact.status === "error" ? (
          <p className="mt-(--space-1) flex items-center gap-(--space-2) rounded-md bg-state-error-veil px-(--space-4) py-(--space-1) text-(length:--text-meta) leading-(--leading-meta) text-state-error">
            {`Couldn't read ${body.name}`}
            <span aria-hidden="true">·</span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                toggleRef.current?.focus();
                setAttempt(attempt + 1);
              }}
            >
              Try again
            </Button>
          </p>
        ) : text === null ? (
          <div data-slot="marker-body" className={SUNKEN}>
            <Shimmer>Reading…</Shimmer>
          </div>
        ) : (
          <div data-slot="marker-body" className={SUNKEN}>
            <div className="select-text">
              <Markdown cutCode>{text}</Markdown>
            </div>
            <div className="mt-(--space-2) flex items-center gap-(--space-3)">
              <span className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
                {contextCharacters(text)}
              </span>
              {discussion?.documents === false ? null : (
                <Button
                  variant="ghost"
                  size="xs"
                  icon={ICONS.file}
                  onClick={() => openPanelAt("documents", body.name)}
                >
                  Open in Documents
                </Button>
              )}
            </div>
          </div>
        );
      break;
    }
    case "artifact": {
      const foot = FOOTS[body.openIn];
      content =
        artifact.status === "error" ? (
          <p className="mt-(--space-1) flex items-center gap-(--space-2) rounded-md bg-state-error-veil px-(--space-4) py-(--space-1) text-(length:--text-meta) leading-(--leading-meta) text-state-error">
            {`Couldn't read ${body.name}`}
            <span aria-hidden="true">·</span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                // Try again goes while the document reloads: the line keeps the focus.
                toggleRef.current?.focus();
                setAttempt(attempt + 1);
              }}
            >
              Try again
            </Button>
          </p>
        ) : artifact.status === "ready" ? (
          <div data-slot="marker-body" className={SUNKEN}>
            <div className="select-text">
              <Markdown cutCode>{documentText(body.name, artifact.content)}</Markdown>
            </div>
            {archived === null && (
              <div className="mt-(--space-2)">
                <Button
                  variant="ghost"
                  size="xs"
                  icon={ICONS.file}
                  onClick={() => openPanelAt(foot.panel, body.name)}
                >
                  {foot.label}
                </Button>
              </div>
            )}
          </div>
        ) : null;
      break;
    }
  }

  return (
    // The line is the stop of the walk, with the state of the fold; the article holds the name.
    <article ref={articleRef} id={id} data-feed-entry aria-label={name} className="flex flex-col">
      <button
        ref={toggleRef}
        type="button"
        data-feed-item
        data-feed-toggle
        tabIndex={-1}
        aria-expanded={open}
        aria-labelledby={id}
        onClick={() => setOpen(!open)}
        className={cn(
          LINE,
          railOf,
          "outline-none transition-colors duration-(--duration-fast) ease-standard hover:bg-veil-hover active:bg-veil-press focus-visible:focus-ring",
        )}
      >
        {cells}
      </button>
      {open && content}
    </article>
  );
}
