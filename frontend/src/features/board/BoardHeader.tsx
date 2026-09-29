import { useId } from "react";
import { Button } from "@/components/system/Button";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/system/Menu";
import { ReadingAge } from "@/components/system/ReadingAge";
import { Tooltip } from "@/components/system/Tooltip";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import type { Board } from "@/lib/wails";
import { openExternal, refreshBoard } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** NEW_DISCUSSION_ID is the button that starts a discussion of the board, which the key notice of N points at. */
export const NEW_DISCUSSION_ID = "board-new-discussion";

export interface BoardHeaderProps {
  board: Board;
  /** now is the clock the age of the reading counts from. */
  now: number;
  /** onNewDiscussion opens a discussion of the board with no card. */
  onNewDiscussion: () => void;
  /** onEnterSelect starts choosing the cards to discuss. */
  onEnterSelect: () => void;
  /** selectDisabledReason is why no card can be selected now, null when one can. */
  selectDisabledReason: string | null;
}

/**
 * BoardHeader is the header of the place of a board: how old its reading is and what the user can
 * do to the board, on the right.
 */
export function BoardHeader({
  board,
  now,
  onNewDiscussion,
  onEnterSelect,
  selectDisabledReason,
}: BoardHeaderProps) {
  const openSettings = useAppStore((state) => state.openSettings);
  const reasonId = useId();
  const neverRead = board.readAt === "";
  const newDiscussionReason = neverRead ? "The board hasn't been read yet." : undefined;
  const newDiscussionTip = `New discussion on ${board.title}, without cards`;

  return (
    <LocationHeader>
      <ReadingAge readAt={board.readAt} reading={board.reading} now={now} />
      <IconButton
        label="Refresh"
        tooltip="Read the board again"
        icon={ICONS.refresh}
        size="sm"
        disabled={board.reading}
        disabledReason="A reading is running."
        onClick={() => void refreshBoard(board.id)}
      />
      <span aria-hidden="true" className="h-(--size-control-sm) w-(--border) bg-line-1" />
      <Tooltip content={newDiscussionReason ?? newDiscussionTip}>
        <Button
          id={NEW_DISCUSSION_ID}
          variant="secondary"
          size="sm"
          icon={ICONS.discussion}
          disabled={neverRead}
          {...(newDiscussionReason !== undefined ? { reasonId } : {})}
          onClick={onNewDiscussion}
        >
          New discussion
        </Button>
      </Tooltip>
      {newDiscussionReason !== undefined && (
        <span id={reasonId} className="sr-only">
          {newDiscussionReason}
        </span>
      )}
      <Menu>
        <MenuTrigger
          render={
            <IconButton
              label="More actions"
              tooltip="Select cards, open on GitHub, edit the board"
              icon={ICONS.more}
              size="sm"
            />
          }
        />
        <MenuContent align="end">
          <MenuItem
            icon={ICONS.select}
            {...(selectDisabledReason !== null ? { disabledReason: selectDisabledReason } : {})}
            onClick={onEnterSelect}
          >
            Select cards to discuss
          </MenuItem>
          <MenuItem icon={ICONS.external} onClick={() => void openExternal(board.url)}>
            Open on GitHub
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={ICONS.settings} onClick={() => openSettings("boards")}>
            Edit the board in Settings…
          </MenuItem>
        </MenuContent>
      </Menu>
    </LocationHeader>
  );
}
