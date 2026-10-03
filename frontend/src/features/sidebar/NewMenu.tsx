import { ChevronDown, Plus } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { IconButton } from "@/components/system/IconButton";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/system/Menu";
import { Tooltip } from "@/components/system/Tooltip";
import { discussionTarget } from "@/features/sidebar/new-discussion-board";
import { useAppStore, useLocation } from "@/store/app-store";

export interface NewMenuProps {
  /** rail draws the trigger as the + of the collapsed strip. */
  rail?: boolean;
  /** disabledReason makes the trigger unavailable: it says why and opens no menu. */
  disabledReason?: string;
}

/** NEW_TOOLTIP is what the trigger of New says it creates. */
const NEW_TOOLTIP = "New task, review or discussion";

/** NEW_SHORTCUT is the key that creates a task from anywhere. */
const NEW_SHORTCUT = "Ctrl+N";

/**
 * NewMenu starts something new: a task, the review of a pull request, or a
 * discussion, asking the board when the place has none. With a reason it is dashed and starts nothing.
 */
export function NewMenu({ rail = false, disabledReason }: NewMenuProps) {
  const reasonId = useId();
  const app = useAppStore((state) => state.app);
  const location = useLocation();
  const openNewTask = useAppStore((state) => state.openNewTask);
  const openReviews = useAppStore((state) => state.openReviews);
  const openNewDiscussion = useAppStore((state) => state.openNewDiscussion);
  const target = discussionTarget(app, location);

  if (disabledReason !== undefined) {
    return (
      <>
        <Tooltip content={disabledReason}>
          <Button
            variant="new"
            size="sm"
            icon={Plus}
            aria-disabled
            aria-describedby={reasonId}
            onClick={() => undefined}
          >
            New
            <Icon icon={ChevronDown} size="sm" />
          </Button>
        </Tooltip>
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      </>
    );
  }

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
          {...(target.kind === "disabled"
            ? { disabledReason: target.reason }
            : {
                onClick: () =>
                  openNewDiscussion({
                    boardId: target.boardId,
                    cardKeys: [],
                    askBoard: target.askBoard,
                  }),
              })}
        >
          New discussion
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
