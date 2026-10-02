import { Fragment } from "react";
import { MenuRow } from "@/components/MenuRow";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/system/Menu";
import { type DiscussionMenuAction, discussionMenu } from "@/features/discussion/discussion-header";
import type { DiscussionSummary } from "@/lib/wails";
import { useAppStore, useBoard } from "@/store/app-store";

export interface DiscussionMenuProps {
  discussion: DiscussionSummary;
}

/** DiscussionMenu is the ⋯ of a discussion: its board, archiving it, and its deletion. */
export function DiscussionMenu({ discussion }: DiscussionMenuProps) {
  const openDiscussionDialog = useAppStore((state) => state.openDiscussionDialog);
  const go = useAppStore((state) => state.go);
  const board = useBoard(discussion.boardId);
  const groups = discussionMenu(discussion, board?.title ?? null);

  const run = (action: DiscussionMenuAction) => {
    switch (action) {
      case "openBoard":
        go({ kind: "board", id: discussion.boardId });
        break;
      case "group":
        openDiscussionDialog(discussion.id, "group");
        break;
      case "archive":
        openDiscussionDialog(discussion.id, "archive");
        break;
      case "delete":
        openDiscussionDialog(discussion.id, "delete");
        break;
    }
  };

  return (
    <Menu>
      <MenuTrigger
        render={
          <IconButton
            label="More actions"
            tooltip="Group drafts into an epic, archive, delete"
            icon={ICONS.more}
            size="sm"
          />
        }
      />
      <MenuContent align="end">
        {groups.map((group) => (
          <Fragment key={group.label ?? "last"}>
            {group.label === null && <MenuSeparator />}
            <MenuGroup>
              {group.label !== null && <MenuGroupLabel>{group.label}</MenuGroupLabel>}
              {group.items.map((item) => (
                <MenuRow key={item.id} item={item} onSelect={() => run(item.action)} />
              ))}
            </MenuGroup>
          </Fragment>
        ))}
      </MenuContent>
    </Menu>
  );
}
