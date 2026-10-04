import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import type { IconGlyph } from "./icons";

export interface BadgeProps {
  variant?: "default" | "edited" | "suggested";
  icon?: IconGlyph;
  children: ReactNode;
  className?: string;
}

const badge = cva(
  "inline-flex items-center gap-(--space-1) rounded-xs border border-line-2 px-(--space-1-5) text-(length:--text-micro) leading-(--leading-micro) text-ink-2 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "",
        edited: "border-line-3 text-ink-1",
        suggested:
          "border-transparent bg-brand-tint text-brand-ink shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]",
      },
    },
  },
);

/** Badge is the small label of a quality, like Revised or Suggested. */
export function Badge({ variant = "default", icon, children, className }: BadgeProps) {
  return (
    <span data-variant={variant} className={cn(badge({ variant }), className)}>
      {icon !== undefined && <Icon icon={icon} size="xs" />}
      {children}
    </span>
  );
}
