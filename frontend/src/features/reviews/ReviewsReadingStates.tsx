import { Button } from "@/components/system/Button";
import { EmptyState } from "@/components/system/EmptyState";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { Spinner } from "@/components/system/Spinner";
import { emptyListBody, failureStrips, noMatchBody } from "@/features/reviews/review-list";
import type { ReviewCenter, State } from "@/lib/wails";
import { refreshPullRequests } from "@/store/actions";

/** SKELETON_BARS is how many bars stand for the pull requests never read. */
const SKELETON_BARS = 4;

/** TryAgain reads the pull requests again, or says that they are being read. */
function TryAgain({ reading }: { reading: boolean }) {
  if (reading) {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-(--space-1-5) px-(--space-2) text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
      >
        <Spinner />
        Reading…
      </span>
    );
  }
  return (
    <Button variant="secondary" size="sm" onClick={() => void refreshPullRequests()}>
      Try again
    </Button>
  );
}

export interface ReviewsFailureStripsProps {
  center: ReviewCenter;
  now: number;
}

/** ReviewsFailureStrips are the repositories the last reading could not read, one strip each, above the list. */
export function ReviewsFailureStrips({ center, now }: ReviewsFailureStripsProps) {
  const strips = failureStrips(center, now);
  return strips.map((strip) => (
    <NoticeStrip
      key={strip.repository}
      title={strip.title}
      reason={strip.message}
      role="alert"
      action={<TryAgain reading={center.reading} />}
      className="mb-(--space-4)"
    />
  ));
}

/** ReadingSkeleton stands in for the pull requests never read, while they are read. */
export function ReadingSkeleton() {
  return (
    <Skeleton label="Reading the pull requests…">
      {Array.from({ length: SKELETON_BARS }, (_, bar) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the bars never move
        <SkeletonBar key={bar} className="h-(--size-control) w-full" />
      ))}
    </Skeleton>
  );
}

/** NoRepositories is what Reviews says before any repository is registered. */
export function NoRepositories() {
  return <EmptyState title="Register a repository to see its pull requests." />;
}

/** NoPullRequests is a reading that found no open pull request. */
export function NoPullRequests({ app }: { app: State }) {
  return (
    <EmptyState
      title="No open pull requests."
      action={
        <Button variant="secondary" size="sm" onClick={() => void refreshPullRequests()}>
          Read now
        </Button>
      }
    >
      {emptyListBody(app)}
    </EmptyState>
  );
}

export interface NoMatchProps {
  center: ReviewCenter;
  onClear: () => void;
}

/** NoMatch says how many pull requests are open when the filters hide all of them. */
export function NoMatch({ center, onClear }: NoMatchProps) {
  return (
    <EmptyState
      title="No pull requests match the filters."
      action={
        <Button variant="secondary" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      }
    >
      {noMatchBody(center)}
    </EmptyState>
  );
}
