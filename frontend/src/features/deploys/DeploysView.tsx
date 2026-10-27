import { useEffect } from "react";
import { PanelLayout } from "@/components/system/AuxPanel";
import { LIST_COLUMN } from "@/components/system/ListPanel";
import { ScrollArea } from "@/components/system/ScrollArea";
import { useNow } from "@/features/attention/useNow";
import { DeploysFilterBar, filterBarShows } from "@/features/deploys/DeploysFilterBar";
import { DeploysHeader } from "@/features/deploys/DeploysHeader";
import {
  DeploysFailureStrip,
  DeploysSkeleton,
  FilterGoneState,
  NoDeploys,
} from "@/features/deploys/DeploysReadingStates";
import { asDeployFilterGone, type DeployBoard, type Deploys } from "@/lib/wails";
import { refreshDeploys } from "@/store/actions";
import { useAppStore, useDeploys } from "@/store/app-store";

/** READING_CLOCK_MS is how often the time since the last reading is told again: a minute. */
const READING_CLOCK_MS = 60_000;

/**
 * DEPLOYS_READ_MS is how often Deploys reads the GitHub again while it is on screen: a minute. With
 * the screen away, Go reads every five minutes.
 */
const DEPLOYS_READ_MS = 60_000;

const NO_BOARDS: DeployBoard[] = [];

/** neverRead tells that the boards have nothing read yet: no whole reading, no failure of it and no repository read on its own. */
function neverRead(deploys: Deploys): boolean {
  return (
    (deploys.boards ?? []).length > 0 &&
    deploys.readAt === "" &&
    deploys.failure === null &&
    !(deploys.boards ?? []).some((board) =>
      (board.repositories ?? []).some((repository) => repository.readAt !== ""),
    )
  );
}

/** DeploysView is the deploys of every board that has them turned on, one matrix per board. */
export function DeploysView() {
  const app = useAppStore((state) => state.app);
  const deploys = useDeploys();
  const boards = deploys.boards ?? NO_BOARDS;
  const now = useNow(READING_CLOCK_MS, deploys.readAt !== "" || deploys.failure !== null);

  // Opening the view reads the deploys again, and it goes on every minute while the view is open;
  // the stored reading shows meanwhile.
  useEffect(() => {
    void refreshDeploys();
    const timer = setInterval(() => void refreshDeploys(), DEPLOYS_READ_MS);
    return () => clearInterval(timer);
  }, []);

  // The states of the screen, in this order: nothing read yet, no board with deploys, the board of
  // the filter gone, and the matrix. Without boards there is nothing to read, so the state says
  // so at once, and only the snapshot not having come yet is a skeleton.
  let view: "skeleton" | "no-deploys" | "filter-gone" | "matrix" = "matrix";
  if (app === null || neverRead(deploys)) {
    view = "skeleton";
  } else if (boards.length === 0) {
    view = "no-deploys";
  } else if (asDeployFilterGone(deploys.filterGone) !== "") {
    view = "filter-gone";
  }
  const bar = (view === "matrix" || view === "filter-gone") && filterBarShows(deploys);

  return (
    <section aria-label="Deploys" className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1">
      <DeploysHeader deploys={deploys} now={now} />
      <PanelLayout panel={null}>
        <ScrollArea className="list-area min-h-0 flex-1">
          <div className={LIST_COLUMN}>
            {view === "skeleton" && <DeploysSkeleton boards={boards} />}
            {view === "no-deploys" && <NoDeploys />}
            {view === "matrix" && <DeploysFailureStrip deploys={deploys} now={now} />}
            {bar && <DeploysFilterBar deploys={deploys} />}
            {view === "filter-gone" && <FilterGoneState deploys={deploys} />}
          </div>
        </ScrollArea>
      </PanelLayout>
    </section>
  );
}
