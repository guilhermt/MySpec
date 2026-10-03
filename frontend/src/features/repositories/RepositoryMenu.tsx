import { type Ref, useRef } from "react";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/system/Menu";
import { hasInstructions, removeReason } from "@/features/repositories/repositories-page";
import type { Repository } from "@/lib/wails";

/** CLONING is why the items that change a repository wait while it is cloned. */
const CLONING = "Cloning…";

export interface RepositoryMenuProps {
  repository: Repository;
  onChangePath: () => void;
  onReviewInstructions: () => void;
  onRemove: () => void;
  /** triggerRef lets the row give the focus back to the ⋯ once a block it opened closes. */
  triggerRef?: Ref<HTMLButtonElement>;
}

/** RepositoryMenu is the ⋯ of a repository row: its path, its review instructions and its removal. */
export function RepositoryMenu({
  repository,
  onChangePath,
  onReviewInstructions,
  onRemove,
  triggerRef,
}: RepositoryMenuProps) {
  const opensBlock = useRef(false);
  const cloning = repository.cloning;
  const blocked = removeReason(repository);

  return (
    <Menu>
      <MenuTrigger
        render={
          <IconButton
            {...(triggerRef !== undefined ? { ref: triggerRef } : {})}
            label={`More for ${repository.fullName}`}
            tooltip="Change path, review instructions, remove"
            icon={ICONS.more}
            size="sm"
          />
        }
      />
      <MenuContent
        align="end"
        finalFocus={() => {
          // The block that Review instructions… opens takes the focus; the menu doesn't take it back.
          const keep = opensBlock.current;
          opensBlock.current = false;
          return !keep;
        }}
      >
        <MenuItem {...(cloning ? { disabledReason: CLONING } : {})} onClick={onChangePath}>
          Change path…
        </MenuItem>
        <MenuItem
          sub={hasInstructions(repository) ? "Set" : "None"}
          onClick={() => {
            opensBlock.current = true;
            onReviewInstructions();
          }}
        >
          Review instructions…
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          destructive
          {...(cloning
            ? { disabledReason: CLONING }
            : blocked !== null
              ? { disabled: true, reason: blocked }
              : {})}
          onClick={onRemove}
        >
          Remove…
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
