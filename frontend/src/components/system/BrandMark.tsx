import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ICONS } from "./icons";

export interface BrandMarkProps {
  size: "sm" | "lg";
}

const SIZES = {
  sm: "size-(--size-mark) rounded-sm",
  lg: "size-(--space-8) rounded-md",
} as const;

/** BrandMark is the product's square: the sidebar's small one and the large one of the first screens. */
export function BrandMark({ size }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      data-size={size}
      className={cn(
        "grid shrink-0 place-items-center bg-brand text-brand-on shadow-mark",
        SIZES[size],
      )}
    >
      <Icon icon={ICONS.mark} {...(size === "lg" ? { className: "size-(--space-5)" } : {})} />
    </span>
  );
}
