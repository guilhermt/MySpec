import { useEffect } from "react";
import { FACTS, Fact } from "@/components/Facts";
import { ChecksList } from "@/components/system/ChecksList";
import { Link } from "@/components/system/Link";
import { ListPanel } from "@/components/system/ListPanel";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { Markdown } from "@/features/chat/Markdown";
import { PullRequestActions } from "@/features/reviews/PullRequestActions";
import { prPanelModel } from "@/features/reviews/pr-panel";
import { useOpenCard } from "@/features/reviews/useOpenCard";
import { checkDuration, checkRows } from "@/lib/pull-requests";
import { asCheckState, type PullRequestRow } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** SECOND is how often the durations of the checks that run are told again. */
const SECOND = 1000;

export interface PullRequestPanelProps {
  row: PullRequestRow;
  /** now is the clock of the view, which tells the ages; a running check counts its own seconds. */
  now: number;
  /** panelFocus asks for the focus on the button of the clone: R on a repository without one. */
  panelFocus: "clone" | null;
  /** onPanelFocused tells the view the request was taken. */
  onPanelFocused: () => void;
  onClose: () => void;
}

/**
 * PullRequestPanel is the pull request open in the list of Reviews: its title and state, what to do
 * with it by its case, its checks by name, its facts and its description.
 */
export function PullRequestPanel({
  row,
  now: viewNow,
  panelFocus,
  onPanelFocused,
  onClose,
}: PullRequestPanelProps) {
  const app = useAppStore((state) => state.app);
  const openCard = useOpenCard();
  const running = (row.checks ?? []).some((check) => asCheckState(check.state) === "running");
  const ticking = useNow(SECOND, running);
  const now = running ? ticking : viewNow;

  // The panel mounts after the key that opened it, and its button after the panel: the focus waits a frame.
  useEffect(() => {
    if (panelFocus !== "clone") {
      return;
    }
    const frame = requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(".list-panel [data-panel-actions] [data-primary]")
        ?.focus();
      onPanelFocused();
    });
    return () => cancelAnimationFrame(frame);
  }, [panelFocus, onPanelFocused]);

  if (app === null) {
    return null;
  }
  const model = prPanelModel(row, { app, now });
  const checks = checkRows(model.checks.reading).map((check) => ({
    ...check,
    duration: checkDuration(check, now),
  }));
  const { facts, meta } = model;

  return (
    <ListPanel
      label={`Pull request ${model.head.reference}`}
      number={model.head.reference}
      repository={model.head.repository}
      url={model.head.url}
      onOpenExternal={(url) => void openExternal(url)}
      onClose={onClose}
      scrollKey={row.key}
      openShortcut="O"
    >
      <div className="flex flex-col gap-(--space-4) px-(--space-4) pt-(--space-3) pb-(--space-6)">
        <div className="flex flex-col gap-(--space-1)">
          <h2 className="text-(length:--text-title) leading-(--leading-title) font-semibold text-ink-1">
            {model.title}
          </h2>
          <p className="text-ink-3">
            <span className="font-medium text-ink-2">{meta.author}</span>
            {meta.state !== null && ` · ${meta.state}`}
            {meta.draft && " · Draft"}
            {" · "}
            <Tooltip content={meta.updatedTooltip}>
              <span>{meta.updated}</span>
            </Tooltip>
          </p>
        </div>
        <PullRequestActions
          row={row}
          action={model.action}
          reference={model.head.reference}
          app={app}
          now={now}
        />
        <ChecksList
          summary={model.checks.summary}
          rows={checks}
          onOpen={(url) => void openExternal(url)}
          trailing={
            model.checks.failed === null
              ? { text: model.checks.age, tooltip: model.checks.ageTooltip }
              : { text: model.checks.failed, error: true, blocked: true }
          }
        />
        <dl className={FACTS}>
          <Fact label="Branch">
            <span className="font-mono">{facts.branch}</span>
          </Fact>
          {facts.card !== null && (
            <Fact label="Card">
              <Link
                href={facts.card.url}
                external
                onClick={(event) => {
                  event.preventDefault();
                  if (facts.card !== null) {
                    openCard(facts.card);
                  }
                }}
              >
                {`#${facts.card.number}`}
              </Link>
              {` ${facts.card.title}`}
              {facts.card.status !== "" && ` · ${facts.card.status}`}
            </Fact>
          )}
          {facts.labels !== "" && <Fact label="Labels">{facts.labels}</Fact>}
          {facts.yourReview !== null && <Fact label="Your review">{facts.yourReview}</Fact>}
        </dl>
        <div className="border-t border-line-1 pt-(--space-4)">
          {model.body.trim() === "" ? (
            <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
              No description.
            </p>
          ) : (
            <Markdown className="card-body">{model.body}</Markdown>
          )}
        </div>
      </div>
    </ListPanel>
  );
}
