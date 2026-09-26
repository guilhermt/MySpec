import { code } from "@streamdown/code";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { useMemo } from "react";
import { Streamdown } from "streamdown";
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

// The safety modal warns before leaving the page; links never navigate here.
const LINK_SAFETY = { enabled: false } as const;

const COMPONENTS = { a: ExternalLink } as const;

export interface MarkdownProps {
  children: string;
  /** streaming keeps the caret and the block animation while text still grows. */
  streaming?: boolean;
  className?: string;
}

export function Markdown({ children, streaming = false, className }: MarkdownProps) {
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
      controls={CONTROLS}
      linkSafety={LINK_SAFETY}
      components={COMPONENTS}
    >
      {children}
    </Streamdown>
  );
}
