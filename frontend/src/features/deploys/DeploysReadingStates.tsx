import { Button } from "@/components/system/Button";
import { EmptyState } from "@/components/system/EmptyState";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { useArrivedLater } from "@/components/system/useArrivedLater";
import { TryAgain } from "@/features/reviews/ReviewsReadingStates";
import { asDeployFilterGone, type DeployBoard, type Deploys } from "@/lib/wails";
import { age } from "@/lib/when";
import { refreshDeploys, setDeployFilter } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** SKELETON_REPOSITORIES is how many repositories the skeleton draws for a board whose repositories are not known yet. */
const SKELETON_REPOSITORIES = 3;

/** SKELETON_ENVIRONMENTS is how many cells the skeleton draws on each row of the matrix. */
const SKELETON_ENVIRONMENTS = 3;

export interface DeploysFailureStripProps {
  deploys: Deploys;
  now: number;
}

/** DeploysFailureStrip is the whole reading failing, above the matrix; null when it did not. */
export function DeploysFailureStrip({ deploys, now }: DeploysFailureStripProps) {
  const { failure } = deploys;
  const role = useArrivedLater(failure !== null) ? "alert" : undefined;
  if (failure === null) {
    return null;
  }
  const since = age(failure.failedAt, now);
  const title = "Couldn't read the deploys";
  return (
    <NoticeStrip
      title={since === "" ? title : `${title} · ${since}`}
      reason={failure.message}
      role={role}
      action={<TryAgain reading={deploys.reading} onRetry={() => void refreshDeploys()} />}
      className="mt-(--space-4) mb-(--space-4)"
    />
  );
}

export interface DeploysSkeletonProps {
  /** boards are the boards with deploys, which give the skeleton the number of rows it draws for each. */
  boards: readonly DeployBoard[];
}

/** DeploysSkeleton stands in for the matrix before anything is read: a title bar and, for each board, a row of blocks per repository. */
export function DeploysSkeleton({ boards }: DeploysSkeletonProps) {
  const rows = boards.length > 0 ? boards.map((board) => board.repositories?.length ?? 0) : [0];
  return (
    <Skeleton label="Reading the deploys…" className="gap-(--space-4) pt-(--space-4)">
      {rows.map((count, board) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the bars never move
        <div key={board} className="flex flex-col gap-(--space-2)">
          <SkeletonBar className="h-(--size-control-sm) w-(--deploy-repo-column)" />
          {Array.from({ length: count > 0 ? count : SKELETON_REPOSITORIES }, (_, row) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: the bars never move
              key={row}
              className="grid items-center gap-(--space-2)"
              style={{
                gridTemplateColumns: `var(--deploy-repo-column) repeat(${SKELETON_ENVIRONMENTS}, minmax(var(--deploy-cell-min), 1fr))`,
              }}
            >
              <SkeletonBar className="h-(--size-control-sm) w-full" />
              {Array.from({ length: SKELETON_ENVIRONMENTS }, (_, cell) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the bars never move
                <SkeletonBar key={cell} className="h-(--size-ask) w-full" />
              ))}
            </div>
          ))}
        </div>
      ))}
    </Skeleton>
  );
}

/** NoDeploys is what Deploys says when no board has them turned on. */
export function NoDeploys() {
  const go = useAppStore((state) => state.go);
  return (
    <EmptyState
      title="No board has deploys."
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => go({ kind: "settings", section: "boards" })}
        >
          Open Settings
        </Button>
      }
    >
      Turn on the deploys of a board in Settings › Boards.
    </EmptyState>
  );
}

/** FilterGoneState is what Deploys says when the board of its filter has no deploys anymore, or is gone. */
export function FilterGoneState({ deploys }: { deploys: Deploys }) {
  const title =
    asDeployFilterGone(deploys.filterGone) === "removed"
      ? "The board in the filter was removed."
      : "The board in the filter has no deploys.";
  return (
    <EmptyState
      title={title}
      action={
        <Button variant="secondary" size="sm" onClick={() => void setDeployFilter("")}>
          Clear filter
        </Button>
      }
    />
  );
}
