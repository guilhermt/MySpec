import { BrandMark } from "@/components/system/BrandMark";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { ThemeButton } from "@/features/sidebar/ThemeButton";
import { cn } from "@/lib/utils";
import { useSidebarRail } from "@/store/app-store";

export interface StartSidebarProps {
  /** still stops the shimmer and the status: the start failed and nothing is loading. */
  still: boolean;
}

interface BarProps {
  still: boolean;
  className: string;
}

/** Bar is one bar of the skeleton, shimmering while the start runs. */
function Bar({ still, className }: BarProps) {
  return still ? (
    <div className={cn("h-4 rounded-sm bg-surface-0", className)} />
  ) : (
    <SkeletonBar className={className} />
  );
}

const NODES = ["w-2/3", "w-1/2", "w-3/5"] as const;

/** Nodes is the tree in skeleton: three nodes, two lines under each. */
function Nodes({ still }: { still: boolean }) {
  return NODES.map((width) => (
    <div key={width} className="flex flex-col gap-(--space-2)">
      <Bar still={still} className={width} />
      <Bar still={still} className="ml-(--space-4) w-3/4" />
      <Bar still={still} className="ml-(--space-4) w-2/3" />
    </div>
  ));
}

/** Blocks is the strip in skeleton: three blocks of an item each. */
function Blocks({ still }: { still: boolean }) {
  return [0, 1, 2].map((block) => (
    <Bar key={block} still={still} className="h-(--size-head) w-full rounded-md" />
  ));
}

/**
 * StartSidebar is the Work sidebar before the first state: the same top and foot with the tree in
 * skeleton, or the strip when it is collapsed, so nothing jumps when the app is ready.
 */
export function StartSidebar({ still }: StartSidebarProps) {
  const rail = useSidebarRail();

  return (
    <aside
      aria-label="Work"
      aria-busy={!still}
      className="@container/sidebar flex h-dvh min-w-0 flex-col bg-surface-sidebar text-ink-1"
    >
      {rail ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-(--space-2) overflow-hidden px-(--space-2) py-(--space-3)">
            {still ? (
              <div aria-hidden="true" className="flex flex-col gap-(--space-2)">
                <Blocks still />
              </div>
            ) : (
              <Skeleton label="Loading your work">
                <Blocks still={false} />
              </Skeleton>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-center py-(--space-2) shadow-[inset_0_var(--border)_0_var(--sidebar-line)]">
            <ThemeButton />
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-(--size-head) shrink-0 items-center gap-(--space-1-5) pr-(--space-2) pl-(--space-3)">
            <span className="flex min-w-0 flex-1 items-center gap-(--space-2) text-(length:--text-body) leading-(--leading-body) font-bold text-ink-1">
              <BrandMark size="sm" />
              <span className="truncate">MySpec</span>
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-(--space-3) py-(--space-3)">
            {still ? (
              <div aria-hidden="true" className="flex flex-col gap-(--space-5)">
                <Nodes still />
              </div>
            ) : (
              <Skeleton label="Loading your work" className="gap-(--space-5)">
                <Nodes still={false} />
              </Skeleton>
            )}
          </div>
          <div className="flex h-(--size-head) shrink-0 items-center justify-end px-(--space-2) shadow-[inset_0_var(--border)_0_var(--sidebar-line)]">
            <ThemeButton />
          </div>
        </>
      )}
    </aside>
  );
}
