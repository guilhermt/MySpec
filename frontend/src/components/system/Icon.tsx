import { cn } from "@/lib/utils";
import type { IconGlyph } from "./icons";

export interface IconProps {
  icon: IconGlyph;
  size?: "md" | "sm" | "xs";
  tone?: "current" | "muted" | "active";
  className?: string;
}

const SIZES = { md: "size-(--icon)", sm: "size-(--icon-sm)", xs: "size-(--icon-xs)" } as const;
const TONES = { current: "", muted: "text-ink-3", active: "text-brand-ink" } as const;

/** Icon is a lucide or system icon at a system size and tone; the stroke comes from the global rule. */
export function Icon({ icon: Glyph, size = "md", tone = "current", className }: IconProps) {
  return (
    <Glyph aria-hidden="true" className={cn("shrink-0", SIZES[size], TONES[tone], className)} />
  );
}
