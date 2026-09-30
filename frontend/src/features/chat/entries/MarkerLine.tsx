import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { ChecksList } from "@/components/system/ChecksList";
import { Finding } from "@/components/system/Finding";
import { Icon } from "@/components/system/Icon";
import { ICONS, type IconMeaning } from "@/components/system/icons";
import { Shimmer } from "@/components/system/Shimmer";
import { Chevron } from "@/features/chat/entries/Chevron";
import { Markdown } from "@/features/chat/Markdown";
import type { MarkerIcon, MarkerView } from "@/features/chat/markers";
import { useReviewArtifact } from "@/features/reviews/useReviewArtifact";
import { useArtifact } from "@/features/task/useArtifact";
import { splitFrontMatter } from "@/lib/front-matter";
import { checkDuration, checkRows } from "@/lib/pull-requests";
import { cn } from "@/lib/utils";
import type { PlanProblem, ReviewSummary, TaskSummary } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { openExternal, openFindingInEditor } from "@/store/actions";
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

function FindingsBody({
  body,
  review,
}: {
  body: Extract<MarkerView["body"], { kind: "findings" }>;
  review: ReviewSummary | null;
}) {
  return (
    <ul data-slot="marker-body" className={cn(SUNKEN, "flex flex-col gap-(--space-2)")}>
      {body.findings.map((finding) => (
        <li key={finding.id}>
          <Finding
            model={finding}
            current
            onOpenLine={() => {
              if (finding.location.kind === "anchored") {
                void openExternal(finding.location.url);
              }
            }}
            onOpenEditor={() => {
              if (review !== null) {
                void openFindingInEditor(review.id, body.pass, finding.number);
              }
            }}
            renderText={(text) => <Markdown cutCode>{text}</Markdown>}
          />
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
  const taskArtifact = useArtifact(
    task?.id ?? "",
    open && body.kind === "artifact" && task !== null ? body.name : null,
    (task?.artifactVersion ?? 0) + attempt,
  );
  // The report of a pass is read again when the agent writes it again, which is its revision.
  const passRevision =
    body.kind === "artifact"
      ? ((review?.passes ?? []).find((pass) => pass.file === body.name)?.revision ?? 0)
      : 0;
  const reviewArtifact = useReviewArtifact(
    review?.id ?? "",
    open && body.kind === "artifact" && review !== null ? body.name : null,
    passRevision + attempt,
  );
  const artifact = review === null ? taskArtifact : reviewArtifact;
  const time = clockTime(createdAt, Date.now());
  const said = view.complement === "" ? view.text : `${view.text} · ${view.complement}`;
  const name = time === "" ? said : `${said}, ${time}`;

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

  const reading = body.kind === "artifact" && artifact.status === "loading";
  const cells = (
    <>
      {opens ? <Chevron open={open} /> : <span aria-hidden="true" className="w-(--icon-xs)" />}
      <Icon
        icon={ICONS[MARKER_ICONS[view.icon]]}
        size="sm"
        className={view.icon === "retry" ? "text-ink-3" : "text-ink-4"}
      />
      <span
        className={cn(
          "shrink-0 whitespace-nowrap text-ink-2",
          view.icon === "product" ? "font-normal" : "font-medium",
        )}
      >
        {reading ? <Shimmer>{view.text}</Shimmer> : view.text}
      </span>
      {view.complement !== "" && (
        <span className="min-w-0 truncate text-ink-3">{view.complement}</span>
      )}
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
      {!view.timeHidden && (
        <span
          className={cn(
            "entry-time shrink-0 text-(length:--text-micro) leading-(--leading-micro) text-ink-4 tabular-nums",
            view.link === undefined || opens ? "ml-auto" : "",
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
        <div className={LINE}>{cells}</div>
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
      content = <FindingsBody body={body} review={review ?? null} />;
      break;
    case "commits":
      content = <CommitsBody body={body} />;
      break;
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
          "outline-none transition-colors duration-(--duration-fast) ease-standard hover:bg-veil-hover active:bg-veil-press focus-visible:focus-ring",
        )}
      >
        {cells}
      </button>
      {open && content}
    </article>
  );
}
