import { code } from "@streamdown/code";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/system/Button";
import { ICONS } from "@/components/system/icons";
import { CUT_SHOWN, codeMarkdown, cutParts, type MarkdownPart } from "@/features/chat/code-cut";
import { CODE_THEMES } from "@/features/chat/code-theme";
import { ExternalLink } from "@/features/chat/ExternalLink";
import { useEffectiveMode } from "@/features/theme/useApplyTheme";
import { cn } from "@/lib/utils";

// Nothing here downloads a file: the webview has no download target.
const CONTROLS = {
  table: false,
  code: { copy: true, download: false },
  mermaid: { copy: false, download: false, fullscreen: true, panZoom: true },
} as const;

// A cut block copies itself whole with its own Copy: Streamdown's would copy the lines shown.
const CUT_CONTROLS = { ...CONTROLS, code: { copy: false, download: false } } as const;

/** COPIED_MS is how long Copy of a cut block says what the copy did. */
const COPIED_MS = 2000;

// The safety modal warns before leaving the page; links never navigate here.
const LINK_SAFETY = { enabled: false } as const;

const COMPONENTS = { a: ExternalLink } as const;

export interface MarkdownProps {
  children: string;
  /** streaming keeps the caret and the block animation while text still grows. */
  streaming?: boolean;
  /** cutCode shows the first lines of a long code block, with the way to the rest: the conversation's reading. */
  cutCode?: boolean;
  /** railLast draws the rail of a question in text beside the last block. */
  railLast?: boolean;
  className?: string;
}

interface BlockProps {
  children: string;
  streaming: boolean;
  className: string | undefined;
  controls?: typeof CONTROLS | typeof CUT_CONTROLS;
}

// Block is one Streamdown over a piece of the text.
function Block({ children, streaming, className, controls = CONTROLS }: BlockProps) {
  const dark = useEffectiveMode() === "dark";
  const plugins = useMemo(
    () => ({
      code,
      mermaid: createMermaidPlugin({
        config: { theme: dark ? "dark" : "neutral", fontFamily: "var(--font-ui)" },
      }),
    }),
    [dark],
  );

  return (
    <Streamdown
      className={cn(
        "markdown text-(length:--text-body) leading-(--leading-body) text-ink-1 max-w-(--measure-conversation)",
        className,
      )}
      mode={streaming ? "streaming" : "static"}
      isAnimating={streaming}
      {...(streaming ? { caret: "block" as const } : {})}
      plugins={plugins}
      shikiTheme={[...CODE_THEMES]}
      lineNumbers={false}
      controls={controls}
      linkSafety={LINK_SAFETY}
      components={COMPONENTS}
    >
      {children}
    </Streamdown>
  );
}

interface CutCodeProps {
  part: Extract<MarkdownPart, { kind: "code" }>;
  streaming: boolean;
  className: string | undefined;
}

// Copied is what the last Copy did, said on the button for COPIED_MS.
type Copied = "idle" | "copied" | "failed";

const COPY_LABELS: Record<Copied, string> = {
  idle: "Copy",
  copied: "Copied",
  failed: "Can't copy · select the text",
};

// CutCode is a long code block showing its first lines, with Copy of the whole block in its header
// and the foot that shows the rest.
function CutCode({ part, streaming, className }: CutCodeProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<Copied>("idle");
  const total = part.lines.length;

  useEffect(() => {
    if (copied === "idle") {
      return;
    }
    const timer = setTimeout(() => setCopied("idle"), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(part.lines.join("\n"));
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  };

  // The frame is the sunken block: Streamdown's code block draws inside it without a frame of its
  // own, and the foot is the last row of the block, under a rule.
  return (
    <div
      data-code-cut
      className="relative flex flex-col overflow-hidden rounded-md bg-surface-0 shadow-[inset_0_0_0_var(--border)_var(--line-1)]"
    >
      <Block streaming={streaming && !part.closed} className={className} controls={CUT_CONTROLS}>
        {codeMarkdown(part, open ? total : CUT_SHOWN)}
      </Block>
      {/* Copy stands at the end of the block's header, where Streamdown puts its own: the header
          is the block's first row, of Streamdown's height (h-8). */}
      <div className="absolute top-0 right-0 flex h-8 items-center pr-(--space-1)">
        <Button
          variant="ghost"
          size="xs"
          {...(copied === "copied" ? { icon: ICONS.done } : {})}
          error={copied === "failed"}
          onClick={() => void copy()}
        >
          {COPY_LABELS[copied]}
        </Button>
      </div>
      <div className="flex items-center gap-(--space-2) px-(--space-1-5) py-(--space-1) text-(length:--text-meta) leading-(--leading-meta) text-ink-3 shadow-[inset_0_var(--border)_0_var(--line-1)]">
        <Button variant="ghost" size="xs" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Show less" : `Show all ${total} lines`}
        </Button>
        {!open && <span className="tabular-nums">{total - CUT_SHOWN} more</span>}
      </div>
    </div>
  );
}

const RAIL = "markdown-rail-last";

/** Markdown draws what the agent wrote; in the conversation, its long code blocks are cut. */
export function Markdown({
  children,
  streaming = false,
  cutCode = false,
  railLast = false,
  className,
}: MarkdownProps) {
  const parts = useMemo(() => (cutCode ? cutParts(children) : null), [cutCode, children]);

  if (parts === null || parts.every((part) => part.kind === "text")) {
    return (
      <Block streaming={streaming} className={cn(railLast && RAIL, className)}>
        {children}
      </Block>
    );
  }
  return (
    <div className="flex flex-col gap-(--space-3)">
      {parts.map((part, index) => {
        const last = index === parts.length - 1;
        const partClass = cn(last && railLast && RAIL, className);
        return part.kind === "text" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the order of the parts never changes
          <Block key={index} streaming={streaming && last} className={partClass}>
            {part.text}
          </Block>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the order of the parts never changes
          <CutCode key={index} part={part} streaming={streaming && last} className={partClass} />
        );
      })}
    </div>
  );
}
