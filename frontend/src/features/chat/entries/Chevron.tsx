import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { cn } from "@/lib/utils";

export interface ChevronProps {
  open: boolean;
}

/** Chevron is the sign of a line that opens, turned while it is open. */
export function Chevron({ open }: ChevronProps) {
  return (
    <Icon
      icon={ICONS.chevron}
      size="xs"
      className={cn(
        "text-ink-4 transition-transform duration-(--duration-fast) ease-standard",
        open && "rotate-90",
      )}
    />
  );
}
