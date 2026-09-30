import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { Kbd as UiKbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export interface KbdProps {
  variant?: "default" | "on-primary" | "jump";
  size?: "md" | "sm";
  children: ReactNode;
  className?: string;
}

const kbd = cva(
  "min-w-0 gap-0 rounded-xs border border-line-2 border-b-(length:--border-2) bg-surface-2 px-1 font-mono text-(length:--text-micro) leading-(--leading-micro) font-normal text-ink-3",
  {
    variants: {
      variant: {
        default: "",
        "on-primary":
          "border-0 bg-transparent text-brand-on shadow-[inset_0_0_0_var(--border)_var(--brand-key-ring)]",
        jump: "border-brand-ring bg-brand-tint text-brand-ink",
      },
      size: { md: "h-(--size-kbd)", sm: "h-(--size-kbd-sm)" },
    },
  },
);

// The fonts of the app have no ↵, so the system draws it with a font of its own, whose width may
// fall between pixels. In a box of 1em it keeps a whole width whatever font draws it.
function keys(children: ReactNode): ReactNode {
  if (typeof children !== "string") return children;
  const at = children.indexOf("↵");
  if (at < 0) return children;
  return (
    <>
      {children.slice(0, at)}
      <span className="inline-block w-[1em] text-center">↵</span>
      {keys(children.slice(at + 1))}
    </>
  );
}

/** Kbd is a key of a shortcut, on a surface, on the primary button, or as the jump key. */
export function Kbd({ variant = "default", size = "md", children, className }: KbdProps) {
  return <UiKbd className={cn(kbd({ variant, size }), className)}>{keys(children)}</UiKbd>;
}
