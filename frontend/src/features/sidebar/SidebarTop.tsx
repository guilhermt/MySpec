import { ChevronsLeft } from "lucide-react";
import { BrandMark } from "@/components/system/BrandMark";
import { IconButton } from "@/components/system/IconButton";
import { NewMenu } from "@/features/sidebar/NewMenu";
import { useAppStore } from "@/store/app-store";

/** SidebarTop is the head of the open sidebar: the mark and the name, New, and the button that collapses it. */
export function SidebarTop() {
  const toggleSidebarRail = useAppStore((state) => state.toggleSidebarRail);

  return (
    <div className="flex h-(--size-head) shrink-0 items-center gap-(--space-1-5) pr-(--space-2) pl-(--space-3)">
      <span className="flex min-w-0 flex-1 items-center gap-(--space-2) text-(length:--text-body) leading-(--leading-body) font-bold text-ink-1">
        <BrandMark size="sm" />
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
