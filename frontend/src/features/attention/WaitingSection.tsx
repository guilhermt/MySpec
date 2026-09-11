import { type KeyboardEvent, useId, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNow } from "@/features/attention/useNow";
import { usePresence } from "@/features/attention/usePresence";
import { ToneDot } from "@/features/task/StatusDot";
import {
  compactWait,
  namesPlace,
  placeLabel,
  situationDetail,
  situationLabel,
  situationTone,
  spokenWait,
  type WaitingEntry,
  waitingEntries,
} from "@/lib/situations";
import { cn } from "@/lib/utils";
import type { State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

/** NOW_INTERVAL_MS is how often the waiting times are read again. */
const NOW_INTERVAL_MS = 60_000;

/** EXIT_MS is how long an entry takes to leave, the base duration of the app. */
const EXIT_MS = 150;

const entryKey = (entry: WaitingEntry) => entry.situation.id;

// What a screen reader hears for an entry: the task, what it waits for, where,
// and for how long. The place is left out when the label already names it.
function spokenEntry(app: State | null, entry: WaitingEntry, now: number): string {
  const { task, situation } = entry;
  const parts = [task.name, situationLabel(situation)];
  if (!namesPlace(situation)) {
    parts.push(placeLabel(app, situation));
  }
  parts.push(`waiting ${spokenWait(situation.startedAt, now)}`);
  return parts.join(", ");
}

// The arrows walk the entries without wrapping around, Home and End go to
// either end. An entry on its way out is inert, and so is no stop.
function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
  const entries = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-waiting-entry]"),
  ).filter((entry) => entry.closest("[inert]") === null);
  const index = event.target instanceof HTMLButtonElement ? entries.indexOf(event.target) : -1;
  let target: HTMLButtonElement | undefined;
  switch (event.key) {
    case "ArrowDown":
      target = entries[Math.min(index + 1, entries.length - 1)];
      break;
    case "ArrowUp":
      target = entries[Math.max(index - 1, 0)];
      break;
    case "Home":
      target = entries[0];
      break;
    case "End":
      target = entries.at(-1);
      break;
    default:
      return;
  }
  event.preventDefault();
  target?.focus();
}

/**
 * WaitingSection lists everything the workspace waits on the user for, most
 * urgent first, so they can pick where to go. The open task is left out: the
 * user is already there.
 */
export function WaitingSection() {
  const app = useAppStore((state) => state.app);
  const openTaskId = useAppStore((state) => state.openTaskId);
  const openPlace = useAppStore((state) => state.openPlace);
  const titleId = useId();
  const entries = useMemo(() => waitingEntries(app, openTaskId), [app, openTaskId]);
  const shown = usePresence(entries, entryKey, EXIT_MS);
  const now = useNow(NOW_INTERVAL_MS, entries.length > 0);
  const open = entries.length > 0;

  return (
    // Always mounted, so that it opens and closes by sliding the tree below
    // instead of making it jump. Closed, nothing in it can be reached.
    <section
      aria-labelledby={titleId}
      inert={!open}
      aria-hidden={!open}
      className={cn(
        "grid shrink-0 transition-[grid-template-rows] duration-[var(--duration-base)] ease-[var(--ease-standard)]",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        {/* The border sits inside what collapses: on the collapsing element
            itself, it would still draw a line under a closed section. */}
        <div className="border-b">
          <div className="flex h-8 items-center gap-2 px-3">
            <h2 id={titleId} className="text-xs font-medium text-muted-foreground">
              Waiting for you
            </h2>
            <span className="rounded-full bg-sidebar-accent px-1.5 text-[11px] font-medium tabular-nums text-sidebar-accent-foreground">
              {/* Closing, it counts the entries on their way out: it never reads 0 as it collapses. */}
              {open ? entries.length : shown.length}
            </span>
          </div>
          {/* Five entries of h-12 and the pb-1 of the list make 61, so the
              sixth entry is the first to scroll. The viewport is capped too:
              its full height means nothing inside a root that only has a
              maximum, and it would grow with the list instead of scrolling. */}
          <ScrollArea className="max-h-61 **:data-[slot=scroll-area-viewport]:max-h-61">
            <ul className="flex flex-col px-1 pb-1" onKeyDown={onListKeyDown}>
              {shown.map(({ key, item: entry, leaving }) => (
                // An entry on its way out only looks gone. inert takes it out of
                // the accessibility tree and of the focus order; aria-hidden says
                // the same to whatever does not honour inert, as on the section.
                <li
                  key={key}
                  inert={leaving}
                  aria-hidden={leaving}
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-[var(--duration-base)] ease-[var(--ease-standard)] starting:grid-rows-[0fr] starting:opacity-0",
                    leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <button
                      type="button"
                      data-waiting-entry=""
                      tabIndex={leaving ? -1 : 0}
                      aria-label={spokenEntry(app, entry, now)}
                      onClick={() => openPlace(entry.task.id, entry.situation.place)}
                      className="flex h-12 w-full flex-col justify-center gap-0.5 rounded-md px-2 text-left outline-none transition-colors duration-[var(--duration-fast)] hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <span className="flex w-full items-center gap-2">
                        <ToneDot tone={situationTone(entry.situation)} />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {entry.task.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {compactWait(entry.situation.startedAt, now)}
                        </span>
                      </span>
                      <span className="truncate pl-4 text-xs text-muted-foreground">
                        {situationDetail(app, entry.situation)}
                      </span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      </div>
    </section>
  );
}
