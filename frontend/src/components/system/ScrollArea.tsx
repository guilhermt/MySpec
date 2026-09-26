import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  label?: string;
}

/**
 * ScrollArea scrolls its content with the thin thumb of the system and no track. Its focus ring
 * is drawn inside: the area fills its container, which would clip a ring outside.
 */
export function ScrollArea({ children, className, viewportClassName, label }: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root className={cn("relative overflow-hidden", className)}>
      <BaseScrollArea.Viewport
        {...(label !== undefined ? { "aria-label": label } : {})}
        className={cn(
          "size-full outline-none focus-visible:outline-(length:--focus-width) focus-visible:outline-focus focus-visible:-outline-offset-(length:--focus-width)",
          viewportClassName,
        )}
      >
        {children}
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar
        orientation="vertical"
        className="flex w-2.5 touch-none p-0.5 select-none"
      >
        <BaseScrollArea.Thumb className="flex-1 rounded-(--radius-pill) bg-line-2 hover:bg-line-3" />
      </BaseScrollArea.Scrollbar>
      <BaseScrollArea.Corner />
    </BaseScrollArea.Root>
  );
}
