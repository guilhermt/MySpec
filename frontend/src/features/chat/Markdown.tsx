import { code } from "@streamdown/code";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { type ReactNode, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/system/Button";
import { CopyButton } from "@/components/system/CopyButton";
import { CutText } from "@/components/system/CutText";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import {
  CUT_ABOVE,
  CUT_SHOWN,
  codeMarkdown,
  codeParts,
  type MarkdownPart,
} from "@/features/chat/code-cut";
import { CODE_THEMES } from "@/features/chat/code-theme";
import { ExternalLink } from "@/features/chat/ExternalLink";
import { useEffectiveMode } from "@/features/theme/useApplyTheme";
import { cn } from "@/lib/utils";

// Nothing here downloads a file: the webview has no download target. The Copy of a code block is the
// CopyButton in the header of the CodeBlock, of the whole block.
const CONTROLS = {
  table: false,
  code: { copy: false, download: false },
  mermaid: { copy: false, download: false, fullscreen: true, panZoom: true },
} as const;

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
  /**
   * renderInlineCode draws a piece of inline code of its own; null leaves it as the code it is.
   * The prompt page draws its placeholders with it.
   */
  renderInlineCode?: (code: string) => ReactNode | null;
  className?: string;
}

interface BlockProps {
  children: string;
  streaming: boolean;
  className: string | undefined;
  renderInlineCode: MarkdownProps["renderInlineCode"];
}

// Block is one Streamdown over a piece of the text.
function Block({ children, streaming, className, renderInlineCode }: BlockProps) {
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
  const components = useMemo(() => {
    if (renderInlineCode === undefined) {
      return COMPONENTS;
    }
    const InlineCode = ({ children: code }: { children?: ReactNode }) => (
      <>
        {(typeof code === "string" ? renderInlineCode(code) : null) ?? (
          <code data-streamdown="inline-code">{code}</code>
        )}
      </>
    );
    return { ...COMPONENTS, inlineCode: InlineCode };
  }, [renderInlineCode]);

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
      controls={CONTROLS}
      linkSafety={LINK_SAFETY}
      components={components}
    >
      {children}
    </Streamdown>
  );
}

interface CodeBlockProps {
  part: Extract<MarkdownPart, { kind: "code" }>;
  streaming: boolean;
  /** cut shows only the first lines of a long block, with the way to the rest. */
  cutCode: boolean;
  className: string | undefined;
}

// A second word of the info that names a file, with the lines of the excerpt when it has them.
const SOURCE = /^([^\s:]+)(?::(\d+)-(\d+))?$/;

// headerOf reads the header of a block from its info: the language, then the file and its lines.
function headerOf(info: string): { language: string; path: string; range: string } {
  const [language = "", source = ""] = info.split(/\s+/);
  const match = SOURCE.exec(source);
  const [, path = "", from, to] = match ?? [];
  return { language, path, range: from !== undefined && to !== undefined ? `${from}–${to}` : "" };
}

// CodeBlock is a fenced code block: the sunken frame, its header with the language, the file and the
// Copy of the whole block, the code, and, for a long one in the conversation, the foot that shows the
// rest.
function CodeBlock({ part, streaming, cutCode, className }: CodeBlockProps) {
  const [open, setOpen] = useState(false);
  const total = part.lines.length;
  const cut = cutCode && total > CUT_ABOVE;
  const { language, path, range } = headerOf(part.info);

  // The frame is the sunken block: Streamdown's code block draws inside it without a frame or a
  // header of its own, and the foot is the last row of the block, under a rule.
  return (
    <div
      data-code-block
      className="relative flex flex-col overflow-hidden rounded-md bg-surface-0 shadow-[inset_0_0_0_var(--border)_var(--line-1)]"
    >
      <div className="flex h-8 items-center gap-(--space-2) px-(--space-3) text-(length:--text-micro) leading-(--leading-micro) text-ink-3 shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]">
        <Icon icon={ICONS.openInEditor} size="sm" />
        {language !== "" && <span>{language}</span>}
        {path !== "" && <CutText text={path} className="font-mono text-ink-3" />}
        {range !== "" && <span className="tabular-nums">{range}</span>}
        <span className="ml-auto">
          <CopyButton
            text={part.lines.join("\n")}
            label="Copy the code"
            variant="icon"
            note="before"
          />
        </span>
      </div>
      <Block
        streaming={streaming && !part.closed}
        className={className}
        renderInlineCode={undefined}
      >
        {codeMarkdown(part, cut && !open ? CUT_SHOWN : total)}
      </Block>
      {cut && (
        <div className="flex items-center gap-(--space-2) px-(--space-1-5) py-(--space-1) text-(length:--text-meta) leading-(--leading-meta) text-ink-3 shadow-[inset_0_var(--border)_0_var(--line-1)]">
          <Button variant="ghost" size="xs" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Show less" : `Show all ${total} lines`}
          </Button>
          {!open && <span className="tabular-nums">{total - CUT_SHOWN} more</span>}
        </div>
      )}
    </div>
  );
}

const RAIL = "markdown-rail-last";

/** Markdown draws what the agent wrote; every code block has its header, and in the conversation the long ones are cut. */
export function Markdown({
  children,
  streaming = false,
  cutCode = false,
  railLast = false,
  renderInlineCode,
  className,
}: MarkdownProps) {
  const parts = useMemo(() => codeParts(children), [children]);

  if (parts.every((part) => part.kind === "text")) {
    return (
      <Block
        streaming={streaming}
        className={cn(railLast && RAIL, className)}
        renderInlineCode={renderInlineCode}
      >
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
          <Block
            // biome-ignore lint/suspicious/noArrayIndexKey: the order of the parts never changes
            key={index}
            streaming={streaming && last}
            className={partClass}
            renderInlineCode={renderInlineCode}
          >
            {part.text}
          </Block>
        ) : (
          <CodeBlock
            // biome-ignore lint/suspicious/noArrayIndexKey: the order of the parts never changes
            key={index}
            part={part}
            streaming={streaming && last}
            cutCode={cutCode}
            className={partClass}
          />
        );
      })}
    </div>
  );
}
