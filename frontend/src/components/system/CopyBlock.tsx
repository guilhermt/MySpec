import { CopyButton } from "./CopyButton";

export interface CopyBlockProps {
  /** label names the text in the header: "error". */
  label: string;
  copyLabel: string;
  text: string;
}

/** CopyBlock is a text to read and copy, sunken: a header with its name and the copy button, then the text as it is. */
export function CopyBlock({ label, copyLabel, text }: CopyBlockProps) {
  return (
    <div className="rounded-md bg-surface-0">
      <div className="flex items-center justify-between gap-(--space-2) py-(--space-1) pr-(--space-1) pl-(--space-3)">
        <span className="text-(length:--text-micro) leading-(--leading-micro) font-medium tracking-wide text-ink-3 uppercase">
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
