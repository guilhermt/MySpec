import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  actionHint,
  actionLabel,
  reviewStatusLabel,
  reviewStatusTone,
} from "@/features/reviews/review-status";
import { ToneDot } from "@/features/task/StatusDot";
import { shortName } from "@/lib/repositories";
import { cn } from "@/lib/utils";
import { asPullRequestAction, type PullRequestRow as Row } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { useAppStore, useReview } from "@/store/app-store";

/** MAX_LABELS is how many labels a row shows before it stops. */
const MAX_LABELS = 3;

export interface PullRequestRowProps {
  row: Row;
}

/** PullRequestRow is one open pull request of the Reviews view, in two lines. */
export function PullRequestRow({ row }: PullRequestRowProps) {
  const app = useAppStore((state) => state.app);
  const openStartReview = useAppStore((state) => state.openStartReview);
  const openReview = useAppStore((state) => state.openReview);
  const openTask = useAppStore((state) => state.openTask);
  const review = useReview(row.reviewId === "" ? null : row.reviewId);
  const action = asPullRequestAction(row.action);
  const hint = actionHint(row, app);
  const labels = row.labels ?? [];

  const act = () => {
    switch (action) {
      // A repository without a clone is offered one by the dialog itself.
      case "review":
      case "clone":
        openStartReview({ repositoryId: row.repositoryId, number: row.number });
        break;
      case "open_review":
        openReview(row.reviewId);
        break;
      case "open_task":
        openTask(row.taskId);
        break;
      case "clone_missing":
      case "fork":
        break;
    }
  };

  const actionButton = (
    <Button size="sm" variant="outline" disabled={hint !== null} onClick={act}>
      {actionLabel(row)}
    </Button>
  );

  return (
    <li
      data-pending={row.pending}
      className={cn(
        "flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted",
        row.pending && "bg-[var(--status-attention)]/5",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          {row.pending && (
            <>
              <ToneDot tone="attention" />
              <span className="sr-only">Pending</span>
            </>
          )}
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {`#${row.number}`}
          </span>
          <span className="min-w-0 truncate text-sm">{row.title}</span>
          {row.draft && <Badge variant="outline">Draft</Badge>}
          {row.taskId !== "" && <Badge variant="secondary">Task</Badge>}
          {review !== null && (
            <Badge variant="outline" className="gap-1.5">
              <ToneDot tone={reviewStatusTone(review)} />
              {reviewStatusLabel(review)}
            </Badge>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span title={row.repository}>{shortName(row.repository)}</span>
          <span aria-hidden="true">·</span>
          <span>{row.author}</span>
          {labels.slice(0, MAX_LABELS).map((label) => (
            <Badge key={label.name} variant="outline" className="h-4 font-normal">
              {label.name}
            </Badge>
          ))}
          {labels.length > MAX_LABELS && <span>{`+${labels.length - MAX_LABELS}`}</span>}
          {row.card !== null && (
            <Button
              variant="link"
              size="xs"
              className="h-auto p-0 text-xs font-normal text-muted-foreground"
              onClick={() => void openExternal(row.card?.url ?? "")}
            >
              {row.card.status === ""
                ? `#${row.card.number}`
                : `#${row.card.number} · ${row.card.status}`}
            </Button>
          )}
          {row.newCommits ? (
            <span className="text-[var(--status-attention)]">New commits</span>
          ) : (
            row.reviewed && <span>Reviewed</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Open on GitHub"
          onClick={() => void openExternal(row.url)}
        >
          <ExternalLink aria-hidden="true" />
        </Button>
        {hint === null ? (
          actionButton
        ) : (
          <Tooltip>
            <TooltipTrigger render={<span />}>{actionButton}</TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </li>
  );
}
