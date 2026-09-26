import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ShimmerProps {
  children: ReactNode;
  className?: string;
}

/** Shimmer is the glow over the text of a reading without a result, like checking GitHub…. */
export function Shimmer({ children, className }: ShimmerProps) {
  return <span className={cn("shimmer-text", className)}>{children}</span>;
}
