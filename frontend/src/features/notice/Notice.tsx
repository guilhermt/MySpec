import { TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BannerProps {
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  className?: string;
}

/** Banner is the shape every notice of the app takes: a title, a body, a way out. */
export function Banner({ title, children, onDismiss, className }: BannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border bg-muted px-3 py-2 text-foreground",
        className,
      )}
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {/* A div, not a paragraph: a notice may carry a list of its own. */}
        <div className="break-words">{children}</div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="-mr-1 shrink-0"
      >
        <X />
      </Button>
    </div>
  );
}
