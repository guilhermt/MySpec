import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { IconButton } from "@/components/system/IconButton";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/system/Menu";
import { Tooltip } from "@/components/system/Tooltip";
import { discussionBoard } from "@/features/sidebar/new-discussion-board";
import { useAppStore, useLocation } from "@/store/app-store";

export interface NewMenuProps {
  /** rail draws the trigger as the + of the collapsed strip. */
  rail?: boolean;
}

/** NEW_TOOLTIP is what the trigger of New says it creates. */
const NEW_TOOLTIP = "New task, review or discussion";

/** NEW_SHORTCUT is the key that creates a task from anywhere. */
const NEW_SHORTCUT = "Ctrl+N";

/**
 * NewMenu starts something new: a task, the review of a pull request, or a
 * discussion of the board of the place on screen.
 */
export function NewMenu({ rail = false }: NewMenuProps) {
  const app = useAppStore((state) => state.app);
  const location = useLocation();
  const openNewTask = useAppStore((state) => state.openNewTask);
  const openReviews = useAppStore((state) => state.openReviews);
  const openNewDiscussion = useAppStore((state) => state.openNewDiscussion);
  const boardId = discussionBoard(app, location);

  return (
    <Menu>
      {rail ? (
        <MenuTrigger
          render={
            <IconButton
              label={NEW_TOOLTIP}
              icon={Plus}
              shortcut={NEW_SHORTCUT}
              size="sm"
              className="text-brand-ink not-aria-disabled:not-aria-pressed:hover:text-brand-ink"
            />
          }
        />
      ) : (
        <Tooltip content={NEW_TOOLTIP} shortcut={NEW_SHORTCUT}>
          <MenuTrigger render={<Button variant="new" size="sm" icon={Plus} />}>
            New
            <Icon icon={ChevronDown} size="sm" />
          </MenuTrigger>
        </Tooltip>
      )}
      <MenuContent align="start">
        <MenuItem shortcut="Ctrl N" onClick={() => openNewTask()}>
          New task
        </MenuItem>
        <MenuItem onClick={() => openReviews()}>Review a pull request</MenuItem>
        <MenuItem
          {...(boardId === null
            ? { disabledReason: "Add a board to discuss its cards." }
            : { onClick: () => openNewDiscussion({ boardId, cardKeys: [] }) })}
        >
          New discussion
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
