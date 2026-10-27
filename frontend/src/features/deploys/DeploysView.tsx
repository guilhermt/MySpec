import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { PanelLayout } from "@/components/system/AuxPanel";
import { KeyNotice, useKeyNotice } from "@/components/system/KeyNotice";
import { isTyping } from "@/components/system/keys";
import { LIST_COLUMN } from "@/components/system/ListPanel";
import { ScrollArea } from "@/components/system/ScrollArea";
import { useNow } from "@/features/attention/useNow";
import { DeployMatrix, type OpenSlot } from "@/features/deploys/DeployMatrix";
import { DeployPanel } from "@/features/deploys/DeployPanel";
import { DeploysFilterBar, filterBarShows } from "@/features/deploys/DeploysFilterBar";
import { DeploysHeader } from "@/features/deploys/DeploysHeader";
import {
  DeploysFailureStrip,
  DeploysSkeleton,
  FilterGoneState,
  NoDeploys,
} from "@/features/deploys/DeploysReadingStates";
import {
  cellKey,
  changes,
  environmentsOf,
  gridSlots,
  keyNotice,
  NO_RUN_NOTICE,
  openUrl,
  passageKey,
} from "@/features/deploys/deploy-matrix";
import { panelModel } from "@/features/deploys/deploy-panel";
import {
  SLOT_ATTRIBUTE,
  slotOf,
  useDeployGridKeyboard,
} from "@/features/deploys/useDeployGridKeyboard";
import { FLASH_MS } from "@/lib/situations";
import {
  asDeployAvailable,
  asDeployFilterGone,
  type DeployBoard,
  type DeployEnvironment,
  type DeployRepository,
  type Deploys,
} from "@/lib/wails";
import { deployInPlace, mergeInPlace, openExternal, refreshDeploys } from "@/store/actions";
import { useAppStore, useDeploys, useLocation } from "@/store/app-store";

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
  const notice = useKeyNotice();
  const root = useRef<HTMLElement>(null);
  const location = useLocation();
  const target = location.kind === "deploys" ? location.target : undefined;
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

  // environmentAt is the repository and the environment of a position, when the boards shown have them.
  const environmentAt = (
    repositoryId: string,
    position: number,
  ): { repo: DeployRepository; env: DeployEnvironment } | null => {
    for (const board of shown) {
      for (const repo of board.repositories ?? []) {
        const env = repo.id === repositoryId ? environmentsOf(repo)[position] : undefined;
        if (env !== undefined) {
          return { repo, env };
        }
      }
    }
    return null;
  };
  const openEnvironment = open === null ? null : environmentAt(open.repositoryId, open.position);

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
  // Arriving with a target opens the panel of that environment and puts the focus on its cell. The
  // target is read once, when it arrives.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs when the target arrives; the rest is read at that moment
  useEffect(() => {
    if (target === undefined) {
      return;
    }
    const key = cellKey(target.repositoryId, target.position);
    setOpen({ repositoryId: target.repositoryId, position: target.position, from: "cell" });
    setFocusKey(key);
    root.current?.querySelector<HTMLElement>(`[${SLOT_ATTRIBUTE}="${CSS.escape(key)}"]`)?.focus();
  }, [target]);

  // An environment that leaves the state takes its panel with it, and the focus goes to the Tab
  // stop of the grid when it was in the panel or had nowhere to be.
  const gone = open !== null && openEnvironment === null && view === "matrix";
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs when the open environment goes away
  useEffect(() => {
    if (!gone) {
      return;
    }
    setOpen(null);
    const active = document.activeElement;
    if (active === null || active === document.body || active.closest(".list-panel") !== null) {
      root.current?.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')?.focus();
    }
  }, [gone]);

  // closePanel closes the environment; the focus goes back to the slot that opened it only when it
  // was in the panel, and a focus on the grid stays where it is.
  const closePanel = () => {
    const inPanel = document.activeElement?.closest(".list-panel") != null;
    const from = open;
    setOpen(null);
    if (inPanel && from !== null) {
      const key =
        from.from === "cell"
          ? cellKey(from.repositoryId, from.position)
          : passageKey(from.repositoryId, from.position);
      root.current?.querySelector<HTMLElement>(`[${SLOT_ATTRIBUTE}="${CSS.escape(key)}"]`)?.focus();
    }
  };

  // act is what D does on an environment: the notice of why it cannot, the call, or the notice of
  // the refusal Go answers at once.
  const act = async (repo: DeployRepository, env: DeployEnvironment, anchor: Element) => {
    const title = `${repo.name} · ${env.name}`;
    const text = keyNotice(env);
    if (text !== null) {
      notice.show(anchor, { title, reason: text });
      return;
    }
    const refusal =
      asDeployAvailable(env.available) === "merge"
        ? await mergeInPlace(repo.id, env.position)
        : await deployInPlace(repo.id, env.position);
    if (refusal !== null) {
      notice.show(anchor, { title, reason: refusal });
    }
  };

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
    const eventTarget = event.target;
    // Dialogs and menus render in a portal: their keys are not the view's.
    if (
      !(eventTarget instanceof Element) ||
      !event.currentTarget.contains(eventTarget) ||
      isTyping(eventTarget)
    ) {
      return;
    }
    if (keyboard.onKeyDown(event)) {
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.key === "Escape") {
      if (notice.notice !== null) {
        notice.hide();
      } else if (open !== null) {
        closePanel();
      } else {
        return;
      }
      event.preventDefault();
      return;
    }
    // The environment a key is about: the one of the slot holding the focus, else the one in the
    // panel when the focus is inside it.
    const element = slotOf(eventTarget);
    const slot =
      element === null
        ? undefined
        : slots.flat().find((candidate) => candidate.key === element.getAttribute(SLOT_ATTRIBUTE));
    const panel = eventTarget.closest(".list-panel");
    const found =
      slot !== undefined
        ? environmentAt(slot.repositoryId, slot.position)
        : panel === null
          ? null
          : openEnvironment;
    if (found === null || (slot === undefined && panel === null)) {
      return;
    }
    const anchor = element ?? panel?.querySelector("[data-panel-actions]") ?? panel ?? eventTarget;
    const key = event.key.toLowerCase();
    if (key === "enter" && slot !== undefined) {
      event.preventDefault();
      activate({ repositoryId: slot.repositoryId, position: slot.position, from: slot.kind });
    } else if (key === "d" && slot === undefined && keyNotice(found.env) === null) {
      // In the panel D with an action is its button: what it does and the refusal it shows.
      event.preventDefault();
      panel?.querySelector<HTMLButtonElement>("[data-panel-actions] [data-primary]")?.click();
    } else if (key === "d") {
      event.preventDefault();
      void act(found.repo, found.env, anchor);
    } else if (key === "o") {
      event.preventDefault();
      const url =
        slot !== undefined
          ? openUrl(found.env, slot.kind)
          : panelModel(found.repo, found.env, now).head.url || null;
      if (url === null) {
        notice.show(anchor, {
          title: `${found.repo.name} · ${found.env.name}`,
          reason: NO_RUN_NOTICE,
        });
      } else {
        void openExternal(url);
      }
    }
  };

  const bar = (view === "matrix" || view === "filter-gone") && filterBarShows(deploys);

  return (
    <section
      ref={root}
      aria-label="Deploys"
      onKeyDown={onKeyDown}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1"
    >
      <DeploysHeader deploys={deploys} now={now} />
      <PanelLayout
        panel={
          openEnvironment !== null && (
            <DeployPanel
              key={`${openEnvironment.repo.id}:${openEnvironment.env.position}`}
              repo={openEnvironment.repo}
              env={openEnvironment.env}
              now={Math.max(now, live)}
              onClose={closePanel}
            />
          )
        }
      >
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
      <KeyNotice notice={notice.notice} onHide={notice.hide} />
    </section>
  );
}
