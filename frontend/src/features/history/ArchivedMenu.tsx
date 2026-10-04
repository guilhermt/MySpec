import { type RefObject, useRef } from "react";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/system/Menu";

export interface ArchivedMenuProps {
  /** tooltip is what the ⋯ says on hover: `Delete from History`. */
  tooltip: string;
  onDelete: () => void;
  /** triggerRef is the ⋯, which the dialog of the deletion gives the focus back to when it closes without deleting. */
  triggerRef: RefObject<HTMLButtonElement | null>;
}

/** ArchivedMenu is the ⋯ of an archived task, review or discussion: Delete…, which opens the confirmation. */
export function ArchivedMenu({ tooltip, onDelete, triggerRef }: ArchivedMenuProps) {
  // The item hands the focus to the dialog it opens; the menu doesn't take it back.
  const handsFocus = useRef(false);

  return (
    <Menu>
      <MenuTrigger
        render={
          <IconButton
            ref={triggerRef}
            label="More actions"
            tooltip={tooltip}
            icon={ICONS.more}
            size="sm"
          />
        }
      />
      <MenuContent
        align="end"
        finalFocus={() => {
          const handed = handsFocus.current;
          handsFocus.current = false;
          return !handed;
        }}
      >
        <MenuItem
          destructive
          onClick={() => {
            handsFocus.current = true;
            onDelete();
          }}
        >
          Delete…
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
