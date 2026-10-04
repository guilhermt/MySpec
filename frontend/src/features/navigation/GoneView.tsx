import { CloseResult } from "@/components/system/CloseResult";
import { CopyBlock } from "@/components/system/CopyBlock";
import type { GoneAction } from "@/components/system/GonePage";
import { GonePage } from "@/components/system/GonePage";
import { ICONS, type IconGlyph } from "@/components/system/icons";
import { closeLegendTime, closeResultLines } from "@/features/history/close-result";
import { gonePassLines, goneReviewText } from "@/features/navigation/gone-passes";
import {
  DELETED_DISCUSSION_TEXT,
  goneDiscussionText,
  goneRoundLines,
} from "@/features/navigation/gone-rounds";
import {
  closedTaskText,
  deletedTaskText,
  forceWarning,
  leftoverCommands,
  leftoverHeading,
  leftoverLines,
} from "@/features/navigation/gone-task";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { findBoard } from "@/lib/boards";
import {
  type GoneLocation,
  type GoneOutcome,
  goneOutcome,
  goneTitle,
  type Location,
  locationTitle,
} from "@/lib/locations";
import { nextWaiting } from "@/lib/situations";
import type { Leftover } from "@/lib/wails";
import {
  useAppStore,
  useArchivedDiscussion,
  useArchivedReview,
  useArchivedTask,
  useBackTarget,
  useLeftoverOf,
  useRepository,
} from "@/store/app-store";

export interface GoneViewProps {
  location: GoneLocation;
}

const ICON: Record<GoneOutcome, IconGlyph> = {
  archived: ICONS.archive,
  deleted: ICONS.trash,
  merged: ICONS.merge,
  closed: ICONS.merge,
  removed: ICONS.board,
};

/** GonePasses is the result of each pass of a review that ended, or of each round of a discussion: what went to GitHub or to the agent, and when. */
function GonePasses({
  label,
  lines,
}: {
  label: string;
  lines: readonly { text: string; time: string }[];
}) {
  return (
    <ul
      aria-label={label}
      className="flex w-full max-w-(--measure-read) flex-col gap-(--space-1-5) rounded-md bg-surface-0 px-(--space-4) py-(--space-3) text-(length:--text-meta) leading-(--leading-meta) text-ink-1 shadow-[inset_0_0_0_var(--border)_var(--line-1)]"
    >
      {lines.map((line) => (
        <li key={line.text} className="flex items-baseline justify-between gap-(--space-4)">
          <span className="min-w-0">{line.text}</span>
          {line.time !== "" && (
            <span className="shrink-0 text-(length:--text-micro) leading-(--leading-micro) text-ink-3 tabular-nums">
              {line.time}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * GoneLeftover is what git couldn't remove when the item was deleted, with the commands that remove it
 * from the clone. The warning of --force comes first: the commands delete what the worktree may still hold.
 */
function GoneLeftover({ leftover }: { leftover: Leftover }) {
  return (
    <CloseResult
      legend="Git couldn't remove everything"
      label="What stayed on disk"
      lines={leftoverLines(leftover)}
    >
      <div className="mt-(--space-2) flex flex-col gap-(--space-2)">
        {forceWarning(leftover) && (
          <p className="flex gap-(--space-1-5) text-(length:--text-meta) leading-(--leading-meta) text-ink-2">
            <span aria-hidden="true">◇</span>
            <span>
              <span className="font-medium text-ink-1">
                --force deletes the modified and untracked files in it too.
              </span>{" "}
              Copy out what you want to keep first.
            </span>
          </p>
        )}
        <CopyBlock
          heading="sentence"
          label={leftoverHeading(leftover)}
          copyLabel="Copy the command"
          text={leftoverCommands(leftover)}
        />
      </div>
    </CloseResult>
  );
}

/**
 * GoneView is the place of an item that left while open: what became of it, read from the state,
 * and the ways on from there.
 */
export function GoneView({ location }: GoneViewProps) {
  const app = useAppStore((state) => state.app);
  const go = useAppStore((state) => state.go);
  const openInHistory = useAppStore((state) => state.openInHistory);
  const goBack = useAppStore((state) => state.goBack);
  const openSituation = useAppStore((state) => state.openSituation);
  const backTarget = useBackTarget();
  const outcome = goneOutcome(app, location);
  // A review that ended says how, from the archive; a deleted one has nothing to say.
  const archived = useArchivedReview(location.item === "review" ? location.id : null);
  const archivedTask = useArchivedTask(location.item === "task" ? location.id : null);
  const close = archivedTask?.close ?? null;
  const repository = useRepository(archivedTask?.repositoryId ?? "");
  const leftover = useLeftoverOf(location.id);
  const archivedDiscussion = useArchivedDiscussion(
    location.item === "discussion" ? location.id : null,
  );
  const now = Date.now();
  const passes = archived === null ? [] : gonePassLines(archived, now);
  const rounds = archivedDiscussion === null ? [] : goneRoundLines(archivedDiscussion, now);

  const actions: GoneAction[] = [];
  if (location.item === "board") {
    actions.push(
      backTarget === null
        ? { label: "Back to Home", onClick: () => go({ kind: "home" }, { focus: "title" }) }
        : {
            label: `Back to ${locationTitle(app, backTarget)}`,
            onClick: () => goBack({ focus: "title" }),
          },
    );
  } else {
    const next = nextWaiting(app, null);
    actions.push(
      next === null
        ? {
            label: "Next that needs you",
            onClick: () => {},
            disabledReason: "Nothing else needs you now.",
          }
        : {
            label: "Next that needs you",
            onClick: () => openSituation(next.itemId, next.situation.place),
            tooltip: `Next: ${next.name}`,
            shortcut: "Ctrl+J",
          },
    );
    if (outcome !== "deleted") {
      const { item, id } = location;
      actions.push({ label: "Open in History", onClick: () => openInHistory(item, id) });
    }
    actions.push(returnAction(location, findBoard(app, location.boardId)?.title ?? null, go));
  }

  return (
    <section aria-label={location.name} className="flex min-h-0 flex-1 flex-col">
      <LocationHeader />
      <GonePage
        icon={ICON[outcome]}
        title={goneTitle(location, outcome)}
        {...(archived !== null ? { description: goneReviewText(archived, now) } : {})}
        {...(location.item === "task"
          ? {
              description:
                archivedTask === null
                  ? deletedTaskText(location.pr)
                  : closedTaskText(archivedTask, now),
            }
          : {})}
        {...(location.item === "discussion"
          ? {
              description:
                archivedDiscussion === null
                  ? DELETED_DISCUSSION_TEXT
                  : goneDiscussionText(archivedDiscussion, now),
            }
          : {})}
        actions={actions}
      >
        {close !== null && (
          <CloseResult
            legend="Closing"
            time={closeLegendTime(close, now)}
            label="What the closing did"
            lines={closeResultLines(close, repository?.path ?? null)}
          />
        )}
        {leftover !== null && <GoneLeftover leftover={leftover} />}
        {passes.length > 0 && <GonePasses label="Passes" lines={passes} />}
        {rounds.length > 0 && <GonePasses label="Rounds" lines={rounds} />}
      </GonePage>
    </section>
  );
}

// The way back from the page: the board the item lived under, Reviews, or Home.
function returnAction(
  location: GoneLocation,
  boardTitle: string | null,
  go: (location: Location, options?: { focus?: "title" }) => void,
): GoneAction {
  const home: GoneAction = {
    label: "Back to Home",
    onClick: () => go({ kind: "home" }, { focus: "title" }),
  };
  if (location.item === "review") {
    return { label: "Back to Reviews", onClick: () => go({ kind: "reviews" }, { focus: "title" }) };
  }
  if (boardTitle === null) {
    return home;
  }
  const board: Location = { kind: "board", id: location.boardId };
  return {
    label: location.item === "task" ? `Back to ${boardTitle}` : `Open ${boardTitle}`,
    onClick: () => go(board, { focus: "title" }),
  };
}
