import type { ReactNode } from "react";
import { Skeleton as UISkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface SkeletonProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export interface SkeletonBarProps {
  className?: string;
}

/** Skeleton stands in for content that is loading, named for the reader. */
export function Skeleton({ label, children, className }: SkeletonProps) {
  return (
    <div role="status" aria-label={label} className={cn("flex flex-col gap-2", className)}>
      {children}
    </div>
  );
}

/**
 * SHIMMER_ANIMATION is the animation of shimmer-fill written as an animate- class, so cn replaces the
 * animate-pulse of the primitive with it; without motion it stops, as shimmer-fill does.
 */
const SHIMMER_ANIMATION =
  "animate-[shimmer_var(--duration-shimmer)_linear_infinite] motion-reduce:animate-none";

/** SkeletonBar is one shimmering line of a skeleton; the caller sets its width. */
export function SkeletonBar({ className }: SkeletonBarProps) {
  return <UISkeleton className={cn("h-4 rounded-sm shimmer-fill", SHIMMER_ANIMATION, className)} />;
}
