import { useRef } from "react";
import { ScrollArea } from "@/components/system/ScrollArea";
import { MoreBelow } from "@/features/sidebar/MoreBelow";
import { SidebarFilter } from "@/features/sidebar/SidebarFilter";
import { SidebarFooter } from "@/features/sidebar/SidebarFooter";
import { SidebarRail } from "@/features/sidebar/SidebarRail";
import { SidebarTop } from "@/features/sidebar/SidebarTop";
import { Tree } from "@/features/sidebar/Tree";
import { NARROW_PX, SidebarWidthContext, useWidth } from "@/features/sidebar/useFits";
import { useRevealOpenItem } from "@/features/sidebar/useRevealOpenItem";
import { useSidebarRail } from "@/store/app-store";

/**
 * Sidebar is the Work sidebar. Open, it holds the top with New, the
 * repository filter, the tree with what is below the fold, and the foot;
 * collapsed, the strip. It measures its own width and tells the tree when it
 * is narrow.
 */
export function Sidebar() {
  const rail = useSidebarRail();
  const ref = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  // Before a first measure the sidebar counts as wide.
  const narrow = width > 0 && width < NARROW_PX;
  useRevealOpenItem();

  return (
    <aside
      ref={ref}
      aria-label="Work"
      className="@container/sidebar flex h-dvh min-w-0 flex-col bg-surface-sidebar text-ink-1"
    >
      {rail ? (
        <SidebarRail />
      ) : (
        <SidebarWidthContext value={narrow}>
          <SidebarTop />
          <SidebarFilter />
          <ScrollArea
            className="min-h-0 flex-1"
            viewportClassName="relative"
            viewportRef={viewport}
          >
            <Tree />
            <MoreBelow viewport={viewport} />
          </ScrollArea>
          <SidebarFooter />
        </SidebarWidthContext>
      )}
    </aside>
  );
}
