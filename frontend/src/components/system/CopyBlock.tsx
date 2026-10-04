import { cn } from "@/lib/utils";
import { CopyButton } from "./CopyButton";

export interface CopyBlockProps {
  /** label names the text in the header: "error". */
  label: string;
  /** heading is how the label is written: "caps" in capitals, "sentence" as a phrase. */
  heading?: "caps" | "sentence";
  copyLabel: string;
  text: string;
}

/** CopyBlock is a text to read and copy, sunken: a header with its name and the copy button, then the text as it is. */
export function CopyBlock({ label, heading = "caps", copyLabel, text }: CopyBlockProps) {
  return (
    <div className="rounded-md bg-surface-0">
      <div className="flex items-center justify-between gap-(--space-2) py-(--space-1) pr-(--space-1) pl-(--space-3)">
        <span
          className={cn(
            "text-(length:--text-micro) leading-(--leading-micro) text-ink-3",
            heading === "caps" && "font-medium tracking-wide uppercase",
          )}
        >
          {label}
        </span>
        <CopyButton variant="icon" label={copyLabel} text={text} note="before" />
      </div>
      <pre className="m-0 px-(--space-3) pb-(--space-3) font-mono text-(length:--text-code) leading-(--leading-code) break-words whitespace-pre-wrap text-ink-1">
        {text}
      </pre>
    </div>
  );
}
