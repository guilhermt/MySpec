import type { ComponentProps } from "react";
import {
  Collapsible as UICollapsible,
  CollapsibleContent as UICollapsibleContent,
  CollapsibleTrigger as UICollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ICONS } from "./icons";

/** Collapsible is the root of a section that opens and closes. */
export const Collapsible = UICollapsible;

export interface CollapsibleTriggerProps extends ComponentProps<typeof UICollapsibleTrigger> {
  className?: string;
}

/** CollapsibleTrigger opens the section, with a chevron that turns when it is open. */
export function CollapsibleTrigger({ className, children, ...props }: CollapsibleTriggerProps) {
  return (
    <UICollapsibleTrigger
      {...props}
      className={cn(
        "group/collapsible inline-flex items-center gap-1.5 rounded-sm text-ink-2 transition-colors duration-(--duration-fast) ease-standard hover:text-ink-1 focus-visible:focus-ring",
        className,
      )}
    >
      <Icon
        icon={ICONS.chevron}
        size="sm"
        className="transition-transform duration-(--duration-fast) ease-standard group-data-panel-open/collapsible:rotate-90"
      />
      {children}
    </UICollapsibleTrigger>
  );
}

/** CollapsibleContent is the part the trigger shows and hides. */
export const CollapsibleContent = UICollapsibleContent;
