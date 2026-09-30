import { AuxPanel } from "@/components/system/AuxPanel";
import { ChecksList } from "@/components/system/ChecksList";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Link } from "@/components/system/Link";
import { PanelRow } from "@/components/system/PanelRow";
import { PanelSection } from "@/components/system/PanelSection";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { reviewDetails } from "@/features/reviews/review-header";
import { useOpenCard } from "@/features/reviews/useOpenCard";
import { ExternalLink, FACTS, Fact } from "@/features/task/DetailsPanel";
import { displayPath } from "@/lib/paths";
import { checkDuration, checkRows } from "@/lib/pull-requests";
import type { ReviewSummary } from "@/lib/wails";
import { fullTime } from "@/lib/when";
import { openExternal } from "@/store/actions";
import { useAppStore, useModelCatalog } from "@/store/app-store";

/** MINUTE is how often the times of the panel are read again. */
const MINUTE = 60_000;

export interface ReviewDetailsProps {
  review: ReviewSummary;
}

/**
 * ReviewDetails is what the review has read and done, and the facts of it: its pull request, the
 * checks read before each pass, its passes, which open their report in Reports, and the review
 * itself.
 */
export function ReviewDetails({ review }: ReviewDetailsProps) {
  const openPanel = useAppStore((state) => state.openPanel);
  const openPanelAt = useAppStore((state) => state.openPanelAt);
  const catalog = useModelCatalog();
  const openCard = useOpenCard();
  const now = useNow(MINUTE, true);
  // The pull request of the list holds the labels, which the review doesn't.
  const row = useAppStore(
    (state) =>
      (state.app?.reviewCenter.pullRequests ?? []).find(
        (candidate) =>
          candidate.repositoryId === review.repositoryId && candidate.number === review.number,
      ) ?? null,
  );
  const model = reviewDetails(review, now, catalog, row);
  const { pullRequest, review: facts } = model;
  // Only a pass with a report opens one.
  const reported = new Set(
    (review.passes ?? []).filter((pass) => pass.recorded).map((p) => p.pass),
  );

  return (
    <AuxPanel id="details" title="Details" onClose={() => openPanel(null)}>
      <div className="flex flex-col gap-(--space-4) px-(--space-4) pt-(--space-3) pb-(--space-6)">
        <PanelSection legend="Pull request">
          <dl className={FACTS}>
            <Fact label="Pull request">
              <ExternalLink url={pullRequest.url}>{pullRequest.reference}</ExternalLink>
            </Fact>
            <Fact label="Author">{pullRequest.author}</Fact>
            <Fact label="Branch">
              <span className="font-mono">{pullRequest.branch}</span>
            </Fact>
            {pullRequest.card !== null && (
              <Fact label="Card">
                <Link
                  href={pullRequest.card.url}
                  external
                  onClick={(event) => {
                    event.preventDefault();
                    if (pullRequest.card !== null) {
                      openCard(pullRequest.card);
                    }
                  }}
                >
                  {`#${pullRequest.card.number}`}
                </Link>
                {` ${pullRequest.card.title}`}
                {pullRequest.card.status !== "" && ` · ${pullRequest.card.status}`}
              </Fact>
            )}
            {pullRequest.labels !== "" && <Fact label="Labels">{pullRequest.labels}</Fact>}
          </dl>
        </PanelSection>

        {model.checks.map((read) => {
          // The checks are as they were read: one that ran then counts up to that moment.
          const readAt = Date.parse(read.reading.checkedAt);
          const rows = checkRows(read.reading).map((row) => ({
            ...row,
            duration: checkDuration(row, Number.isNaN(readAt) ? now : readAt),
          }));
          return (
            <PanelSection key={read.pass} legend={read.title}>
              <ChecksList
                summary={read.summary}
                rows={rows}
                onOpen={(url) => void openExternal(url)}
              />
            </PanelSection>
          );
        })}

        <PanelSection legend="Passes">
          <ul className="flex flex-col">
            {model.passes.map((pass) => (
              <li key={pass.pass}>
                <PanelRow
                  glyph={<Icon icon={ICONS.file} size="sm" />}
                  {...(pass.meta !== "" ? { meta: pass.meta } : {})}
                  {...(reported.has(pass.pass)
                    ? { onClick: () => openPanelAt("reports", pass.file) }
                    : {})}
                >
                  {pass.text}
                </PanelRow>
              </li>
            ))}
          </ul>
        </PanelSection>

        <PanelSection legend="Review">
          <dl className={FACTS}>
            <Fact label="Mode">{facts.mode}</Fact>
            {facts.model !== "" && <Fact label="Model">{facts.model}</Fact>}
            {facts.worktree !== "" && (
              <Fact label="Worktree">
                <span className="font-mono">{displayPath(facts.worktree)}</span>
              </Fact>
            )}
            <Fact label="Started">
              <Tooltip content={fullTime(review.createdAt)}>
                <span>{facts.started}</span>
              </Tooltip>
            </Fact>
          </dl>
        </PanelSection>
      </div>
    </AuxPanel>
  );
}
