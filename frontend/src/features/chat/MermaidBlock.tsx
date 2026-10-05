import { createMermaidPlugin } from "@streamdown/mermaid";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog } from "@/components/system/Dialog";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { CodeFrame } from "@/features/chat/CodeFrame";
import { useEffectiveMode } from "@/features/theme/useApplyTheme";

/** MIN_ZOOM, MAX_ZOOM and ZOOM_STEP are the factors the full screen scales the diagram by. */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

interface Drawing {
  /** markup is the SVG of the diagram, scaled by the width of its container. */
  markup: string;
  /** width is the natural width of the diagram, in pixels. */
  width: number;
}

type Drawn =
  | { source: string; theme: string; state: "drawn"; drawing: Drawing }
  | { source: string; theme: string; state: "failed"; message: string };

// naturalOf makes the SVG of Mermaid, which scales itself to a maximum width, take the width of its
// container, and reads the natural width off its view box.
function naturalOf(svg: string): Drawing {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  const box =
    root
      .getAttribute("viewBox")
      ?.split(/[\s,]+/)
      .map(Number) ?? [];
  const width = Math.round(box[2] ?? Number.parseFloat(root.getAttribute("width") ?? "0"));
  root.setAttribute("width", "100%");
  root.removeAttribute("height");
  root.removeAttribute("style");
  return {
    markup: new XMLSerializer().serializeToString(root),
    width: Number.isNaN(width) ? 0 : width,
  };
}

// useDrawing draws the diagram once its block is closed, and again when the source or the theme change.
function useDrawing(source: string, closed: boolean): Drawn | null {
  const id = `mermaid-${useId().replace(/\W/g, "")}`;
  const theme = useEffectiveMode() === "dark" ? "dark" : "neutral";
  const [drawn, setDrawn] = useState<Drawn | null>(null);

  useEffect(() => {
    if (!closed) {
      return;
    }
    let current = true;
    const config = { theme, fontFamily: "var(--font-ui)", securityLevel: "strict" } as const;
    createMermaidPlugin({ config })
      .getMermaid(config)
      .render(id, source)
      .then(({ svg }) => {
        if (current) {
          setDrawn({ source, theme, state: "drawn", drawing: naturalOf(svg) });
        }
      })
      .catch((error: unknown) => {
        if (current) {
          const message = error instanceof Error ? error.message : String(error);
          setDrawn({ source, theme, state: "failed", message });
        }
      });
    return () => {
      current = false;
    };
  }, [id, source, closed, theme]);

  // A drawing of another source or theme is stale: the block shows its code until the new one comes.
  return drawn !== null && drawn.source === source && drawn.theme === theme ? drawn : null;
}

// Diagram is the SVG at its natural width, or at the width of its container when that is narrower.
// The height of a scaled SVG is a fraction of a pixel, which the box rounds up to a whole one.
function Diagram({ drawing, width }: { drawing: Drawing; width: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new drawing is a new SVG to measure
  useLayoutEffect(() => {
    const element = box.current;
    const svg = element?.querySelector("svg");
    if (element === null || svg === null || svg === undefined) {
      return;
    }
    const measure = () => setHeight(Math.ceil(svg.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [drawing]);
  return (
    <div className="p-(--space-3)">
      <div
        ref={box}
        style={{
          width: `${width}px`,
          maxWidth: "100%",
          ...(height === undefined ? {} : { height: `${height}px` }),
        }}
        // The markup is the SVG Mermaid drew with securityLevel "strict", which sanitizes it.
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the sanitized SVG of the diagram
        dangerouslySetInnerHTML={{ __html: drawing.markup }}
      />
    </div>
  );
}

// SourceText is the code of the diagram as text, what the block shows until the drawing comes.
function SourceText({ source }: { source: string }) {
  return (
    <pre className="m-0 overflow-x-auto px-(--space-3) pt-(--space-2) pb-(--space-3) font-mono text-(length:--text-code) leading-(--leading-code) text-ink-1">
      {source}
    </pre>
  );
}

// FullScreen is the diagram in a dialog of the size of the window, with zoom by width. It is mounted
// while open, so each opening starts at the natural size.
function FullScreen({ drawing, onClose }: { drawing: Drawing; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Diagram" size="full">
      <div className="flex items-center gap-(--space-1) px-(--space-5) pb-(--space-2)">
        <IconButton
          label="Zoom out"
          icon={ICONS.zoomOut}
          size="sm"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}
        />
        <IconButton
          label="Zoom in"
          icon={ICONS.zoomIn}
          size="sm"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}
        />
        <Button variant="ghost" size="sm" disabled={zoom === 1} onClick={() => setZoom(1)}>
          Reset zoom
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-surface-0">
        <Diagram drawing={drawing} width={Math.round(drawing.width * zoom)} />
      </div>
    </Dialog>
  );
}

export interface MermaidBlockProps {
  /** source is the diagram's code, without its fences. */
  source: string;
  /** closed is false while the block still streams: it is drawn once it closes. */
  closed: boolean;
}

/**
 * MermaidBlock is a diagram in the frame of a code block: the natural size, a Full screen that zooms,
 * and the code as text until the drawing comes or when it fails.
 */
export function MermaidBlock({ source, closed }: MermaidBlockProps) {
  const drawn = useDrawing(source, closed);
  const [fullScreen, setFullScreen] = useState(false);
  const drawing = drawn?.state === "drawn" ? drawn.drawing : null;
  const status =
    drawn === null ? (
      <span className="flex items-center gap-(--space-1-5)">
        <Spinner />
        Drawing the diagram…
      </span>
    ) : null;

  return (
    <CodeFrame
      language="mermaid"
      copyText={source}
      status={status}
      actions={
        drawing !== null && (
          <IconButton
            label="Full screen"
            icon={ICONS.fullscreen}
            size="xs"
            onClick={() => setFullScreen(true)}
          />
        )
      }
    >
      {drawing !== null ? (
        <>
          <Diagram drawing={drawing} width={drawing.width} />
          {fullScreen && <FullScreen drawing={drawing} onClose={() => setFullScreen(false)} />}
        </>
      ) : (
        <>
          {drawn?.state === "failed" && (
            <p className="m-0 px-(--space-3) pt-(--space-2) text-(length:--text-meta) leading-(--leading-meta) text-state-error">
              Couldn't draw the diagram: {drawn.message}
            </p>
          )}
          <SourceText source={source} />
        </>
      )}
    </CodeFrame>
  );
}
