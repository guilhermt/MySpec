import { ICONS, type IconMeaning } from "@/components/system/icons";
import { MenuItem } from "@/components/system/Menu";
import { Tooltip } from "@/components/system/Tooltip";

/** MenuRowItem is what a row of a ⋯ draws, the ⋯ of a task or of a review. */
export interface MenuRowItem {
  /** label is "Discard step 4…", "Back to PRD…", "Review mode". */
  label: string;
  icon?: IconMeaning;
  /** shortcut is "Ctrl+E". */
  shortcut?: string;
  /** sub is the hint beside the label: "Agent", "Manual", "per stage". */
  sub?: string;
  /** opensPopover draws the ›. */
  opensPopover?: boolean;
  /** tooltip is "Read the pull request now · checked 2m ago". */
  tooltip?: string;
  /** disabledReason is why the item can't be chosen: "the worktree doesn't exist yet". */
  disabledReason?: string;
  destructive?: boolean;
}

export interface MenuRowProps {
  item: MenuRowItem;
  onSelect: () => void;
}

/** MenuRow is one item of the ⋯ of a task or a review, with its tooltip when it has one. */
export function MenuRow({ item, onSelect }: MenuRowProps) {
  const row = (
    <MenuItem
      onClick={onSelect}
      {...(item.icon !== undefined ? { icon: ICONS[item.icon] } : {})}
      {...(item.shortcut !== undefined ? { shortcut: item.shortcut } : {})}
      {...(item.sub !== undefined ? { sub: item.sub } : {})}
      {...(item.disabledReason !== undefined ? { disabledReason: item.disabledReason } : {})}
      {...(item.destructive ? { destructive: true } : {})}
    >
      {item.label}
      {item.opensPopover && <span aria-hidden="true"> ›</span>}
    </MenuItem>
  );
  return item.tooltip === undefined ? row : <Tooltip content={item.tooltip}>{row}</Tooltip>;
}
