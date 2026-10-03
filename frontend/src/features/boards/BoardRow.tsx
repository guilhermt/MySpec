import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { CutText } from "@/components/system/CutText";
import { ICONS } from "@/components/system/icons";
import { Link } from "@/components/system/Link";
import { ReadingAge } from "@/components/system/ReadingAge";
import { Spinner } from "@/components/system/Spinner";
import { SunkenLine } from "@/components/system/SunkenLine";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { BoardDialog } from "@/features/boards/BoardDialog";
import {
  boardRowName,
  finalsLine,
  projectRef,
  repositoriesLine,
} from "@/features/boards/boards-page";
import { RemoveBoardDialog } from "@/features/boards/RemoveBoardDialog";
import { SettingsRow } from "@/features/settings/SettingsList";
import type { Board } from "@/lib/wails";
import { openExternal, refreshBoard } from "@/store/actions";
import { useRepositories } from "@/store/app-store";

/** READING_CLOCK_MS is how often the time since the last reading is told again: a minute. */
const READING_CLOCK_MS = 60_000;

const META = "text-(length:--text-meta) leading-(--leading-meta)";

export interface BoardRowProps {
  board: Board;
  /** onRemoved is called when the board is gone, for the page to place the focus. */
  onRemoved?: () => void;
}

/** BoardRow is one registered board: what it manages, how its last reading went, and what can be done to it. */
export function BoardRow({ board, onRemoved }: BoardRowProps) {
  const repositories = useRepositories();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const now = useNow(READING_CLOCK_MS, true);
  const failure = board.failure;
  // A failure that was there when the page opened is read with the page; one that comes after is announced.
  const failedAtFirst = useRef(failure !== null);
  useEffect(() => {
    if (failure === null) {
      failedAtFirst.current = false;
    }
  }, [failure]);
  const count = (board.repositoryIds ?? []).length;
  const repositoriesText = repositoriesLine(board, repositories);

  return (
    <>
      <SettingsRow
        icon="board"
        name={boardRowName(board, count, now)}
        lines={
          <>
            <div className="flex min-w-0 items-baseline gap-(--space-2)">
              <span className="min-w-0 truncate text-(length:--text-ui) leading-(--leading-ui) font-medium text-ink-1">
                {board.title}
              </span>
              <Tooltip content={`Open the project on GitHub · ${board.url}`}>
                <Link
                  href={board.url}
                  external
                  onClick={(event) => {
                    event.preventDefault();
                    void openExternal(board.url);
                  }}
                  className={`shrink-0 ${META}`}
                >
                  {projectRef(board)}
                </Link>
              </Tooltip>
            </div>
            <CutText text={repositoriesText} className={`${META} text-ink-3`} />
            <span className={`${META} text-ink-3`}>{finalsLine(board)}</span>
          </>
        }
        trailing={
          <>
            <ReadingAge
              readAt={board.readAt}
              reading={board.reading}
              now={now}
              never
              {...(failure === null ? {} : { failure })}
            />
            <Button
              variant="secondary"
              size="sm"
              aria-label={`Edit ${board.title}`}
              onClick={() => setEditing(true)}
            >
              Edit…
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${board.title}`}
              onClick={() => setRemoving(true)}
            >
              Remove…
            </Button>
          </>
        }
        below={
          failure === null ? undefined : (
            <div
              {...(failedAtFirst.current ? {} : { role: "alert" })}
              className="ml-[calc(var(--icon)+var(--space-3))]"
            >
              <SunkenLine
                icon="blocked"
                className="min-h-(--size-control-sm) py-(--space-1) pr-(--space-3)"
                action={
                  board.reading ? (
                    <span
                      aria-busy="true"
                      className={`inline-flex items-center gap-(--space-1-5) text-ink-3 ${META}`}
                    >
                      <Spinner />
                      Reading…
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={ICONS.refresh}
                      onClick={() => void refreshBoard(board.id)}
                    >
                      Try again
                    </Button>
                  )
                }
              >
                {failure.message} The last reading stays in use.
              </SunkenLine>
            </div>
          )
        }
      />
      <BoardDialog mode="edit" boardId={board.id} open={editing} onOpenChange={setEditing} />
      <RemoveBoardDialog
        board={board}
        open={removing}
        onOpenChange={setRemoving}
        {...(onRemoved === undefined ? {} : { onRemoved })}
      />
    </>
  );
}
