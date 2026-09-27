import { ChevronsLeft } from "lucide-react";
import { Icon } from "@/components/system/Icon";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { NewMenu } from "@/features/sidebar/NewMenu";
import { useAppStore } from "@/store/app-store";

/** SidebarTop is the head of the open sidebar: the mark and the name, New, and the button that collapses it. */
export function SidebarTop() {
  const toggleSidebarRail = useAppStore((state) => state.toggleSidebarRail);

  return (
    <div className="flex h-(--size-head) shrink-0 items-center gap-(--space-1-5) pr-(--space-2) pl-(--space-3)">
      <span className="flex min-w-0 flex-1 items-center gap-(--space-2) text-(length:--text-body) leading-(--leading-body) font-bold text-ink-1">
        <span className="grid size-(--size-mark) shrink-0 place-items-center rounded-sm bg-brand text-brand-on shadow-mark">
          <Icon icon={ICONS.mark} />
        </span>
        <span className="truncate">MySpec</span>
      </span>
      <NewMenu />
      <IconButton
        label="Collapse the sidebar"
        icon={ChevronsLeft}
        size="sm"
        onClick={() => toggleSidebarRail()}
      />
    </div>
  );
}
