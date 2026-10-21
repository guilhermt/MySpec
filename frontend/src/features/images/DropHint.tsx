import { cn } from "@/lib/utils";

type DropHintProps = {
  /** rounded follows the corners of the target it covers. */
  rounded?: "md" | "lg";
};

/** DropHint covers the target of a drag of files, which says what dropping does. */
export function DropHint({ rounded = "md" }: DropHintProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-surface-input/80 text-(length:--text-meta) leading-(--leading-meta) text-ink-2",
        rounded === "lg" ? "rounded-lg" : "rounded-md",
      )}
    >
      Drop images to attach
    </div>
  );
}
