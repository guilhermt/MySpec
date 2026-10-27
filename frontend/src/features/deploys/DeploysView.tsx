import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { PanelLayout } from "@/components/system/AuxPanel";
import { isTyping } from "@/components/system/keys";
import { LIST_COLUMN } from "@/components/system/ListPanel";
import { ScrollArea } from "@/components/system/ScrollArea";
import { useNow } from "@/features/attention/useNow";
import { DeployMatrix, type OpenSlot } from "@/features/deploys/DeployMatrix";
import { DeploysFilterBar, filterBarShows } from "@/features/deploys/DeploysFilterBar";
import { DeploysHeader } from "@/features/deploys/DeploysHeader";
import {
  DeploysFailureStrip,
  DeploysSkeleton,
  FilterGoneState,
  NoDeploys,
} from "@/features/deploys/DeploysReadingStates";
import { changes, gridSlots } from "@/features/deploys/deploy-matrix";
import { useDeployGridKeyboard } from "@/features/deploys/useDeployGridKeyboard";
import { FLASH_MS } from "@/lib/situations";
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

const NO_KEYS: ReadonlySet<string> = new Set();

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

/** RUNNING_CLOCK_MS is how often the length of what runs is told again: a second. */
const RUNNING_CLOCK_MS = 1_000;

/** DeploysView is the deploys of every board that has them turned on, one matrix per board. */
export function DeploysView() {
  const app = useAppStore((state) => state.app);
  const deploys = useDeploys();
  const boards = deploys.boards ?? NO_BOARDS;
  const announce = useAppStore((state) => state.announce);
  const now = useNow(READING_CLOCK_MS, deploys.readAt !== "" || deploys.failure !== null);
  // The environment whose panel is open, and the slot of the grid with the Tab stop.
  const [open, setOpen] = useState<OpenSlot | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [flashing, setFlashing] = useState<ReadonlySet<string>>(NO_KEYS);
  const shown = useMemo(() => boards.filter((board) => board.shown), [boards]);
  const slots = useMemo(() => gridSlots(shown), [shown]);
  const keyboard = useDeployGridKeyboard(slots, focusKey, setFocusKey);
  // The live clock of what runs: a second.
  const running = shown.some((board) =>
    (board.repositories ?? []).some((repo) =>
      (repo.environments ?? []).some((env) => env.running || env.action !== null),
    ),
  );
  const live = useNow(RUNNING_CLOCK_MS, running);

  // Opening the view reads the deploys again, and it goes on every minute while the view is open;
  // the stored reading shows meanwhile.
  useEffect(() => {
    void refreshDeploys();
    const timer = setInterval(() => void refreshDeploys(), DEPLOYS_READ_MS);
    return () => clearInterval(timer);
  }, []);

  // Each new reading flashes the cells that changed and announces the changes, in one sentence.
  const read = useRef(deploys);
  useEffect(() => {
    const before = read.current;
    read.current = deploys;
    if (before === deploys) {
      return;
    }
    const found = changes(before, deploys);
    if (found.length === 0) {
      return;
    }
    setFlashing(new Set(found.map((change) => change.key)));
    announce(found.map((change) => change.text).join(". "));
  }, [deploys, announce]);

  // The flash ends on its own timer, which a later reading does not cancel.
  useEffect(() => {
    if (flashing.size === 0) {
      return;
    }
    const timer = setTimeout(() => setFlashing(NO_KEYS), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashing]);

  // activate is a click on a cell or a passage: it records the slot, and on the open one clears it.
  const activate = (slot: OpenSlot) =>
    setOpen((current) =>
      current?.repositoryId === slot.repositoryId &&
      current.position === slot.position &&
      current.from === slot.from
        ? null
        : slot,
    );

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target;
    // Dialogs and menus render in a portal: their keys are not the view's.
    if (!(target instanceof Element) || !event.currentTarget.contains(target) || isTyping(target)) {
      return;
    }
    keyboard.onKeyDown(event);
  };

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
    <section
      aria-label="Deploys"
      onKeyDown={onKeyDown}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1"
    >
      <DeploysHeader deploys={deploys} now={now} />
      <PanelLayout panel={null}>
        <ScrollArea className="list-area min-h-0 flex-1">
          <div className={LIST_COLUMN}>
            {view === "skeleton" && <DeploysSkeleton boards={boards} />}
            {view === "no-deploys" && <NoDeploys />}
            {view === "matrix" && <DeploysFailureStrip deploys={deploys} now={now} />}
            {bar && <DeploysFilterBar deploys={deploys} />}
            {view === "matrix" && (
              <DeployMatrix
                boards={shown}
                now={Math.max(now, live)}
                keyboard={keyboard}
                open={open}
                flashing={flashing}
                onActivate={activate}
              />
            )}
            {view === "filter-gone" && <FilterGoneState deploys={deploys} />}
          </div>
        </ScrollArea>
      </PanelLayout>
    </section>
  );
}
