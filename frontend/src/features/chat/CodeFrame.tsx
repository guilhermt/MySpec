import type { ReactNode } from "react";
import { CopyButton } from "@/components/system/CopyButton";
import { CutText } from "@/components/system/CutText";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";

export interface CodeFrameProps {
  language: string;
  /** path and range name the file an excerpt comes from, when the info of the block says it. */
  path?: string;
  range?: string;
  /** copyText is what Copy the code puts on the clipboard: the whole block. */
  copyText: string;
  /** status is what the header says of the block's drawing, with its spinner. */
  status?: ReactNode;
  /** actions are the buttons of the header that come before Copy the code. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * CodeFrame is the sunken block of the conversation: the header with the language, the file and the
 * Copy of the whole block over a rule, and the body. A fenced code block and a diagram share it.
 */
export function CodeFrame({
  language,
  path = "",
  range = "",
  copyText,
  status,
  actions,
  children,
}: CodeFrameProps) {
  return (
    <div
      data-code-block
      className="relative flex flex-col overflow-hidden rounded-md bg-surface-0 shadow-[inset_0_0_0_var(--border)_var(--line-1)]"
    >
      <div className="flex h-(--space-8) items-center gap-(--space-2) px-(--space-3) text-(length:--text-micro) leading-(--leading-micro) text-ink-3 shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]">
        <Icon icon={ICONS.openInEditor} size="sm" />
        {language !== "" && <span>{language}</span>}
        {path !== "" && <CutText text={path} className="font-mono text-ink-3" />}
        {range !== "" && <span className="tabular-nums">{range}</span>}
        {status}
        <span className="ml-auto flex items-center gap-(--space-1)">
          {actions}
          <CopyButton text={copyText} label="Copy the code" variant="icon" note="before" />
        </span>
      </div>
      {children}
    </div>
  );
}
