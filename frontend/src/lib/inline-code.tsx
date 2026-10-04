import type { ReactNode } from "react";

/**
 * inlineCode writes a title that carries code between backticks: each stretch between a pair of them
 * is drawn as code, mono on the sunken surface like the code of a finding's text, and the backticks
 * themselves do not show. A backtick with no partner stays as it is.
 */
export function inlineCode(title: string): ReactNode {
  const parts = title.split("`");
  if (parts.length % 2 === 0) return title;
  return parts.map((part, index) => {
    // An even index is the text outside a pair of backticks, an odd one the code inside it.
    const key = `${index}:${part}`;
    if (part === "") return null;
    return index % 2 === 1 ? (
      <code
        key={key}
        className="rounded-xs bg-surface-0 px-(--code-pad-x) py-(--code-pad-y) font-mono text-(length:--text-code-read) font-normal text-ink-1"
      >
        {part}
      </code>
    ) : (
      part
    );
  });
}

/** spokenTitle is a title as assistive technology reads it: without the backticks that mark code. */
export function spokenTitle(title: string): string {
  return title.replaceAll("`", "");
}
