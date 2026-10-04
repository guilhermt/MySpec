import { useEffect, useRef, useState } from "react";
import { AuxPanel } from "@/components/system/AuxPanel";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { PanelRow } from "@/components/system/PanelRow";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { Markdown } from "@/features/chat/Markdown";
import { reportLabel, verdictLabel } from "@/features/reviews/review-status";
import { useReviewArtifact } from "@/features/reviews/useReviewArtifact";
import type { ReviewPass, ReviewSummary } from "@/lib/wails";
import { readMoment } from "@/lib/when";
import { openExternal } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

/** LOADING_WIDTHS are the three bars of the skeleton while a report is read. */
const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

/** CONTEXT_FILE is the document the app writes for the agent before every pass. */
const CONTEXT_FILE = "context.md";

/** Selection is the list of reports, or the document drilled into. */
type Selection = "list" | "context" | { pass: number };

function isPass(selection: Selection): selection is { pass: number } {
  return typeof selection === "object";
}

// selectionOf is the document a marker or a row of Details asked the panel to open at.
function selectionOf(file: string | null, passes: readonly ReviewPass[]): Selection {
  if (file === CONTEXT_FILE) {
    return "context";
  }
  const pass = passes.find((candidate) => candidate.file === file);
  return pass === undefined ? "list" : { pass: pass.pass };
}

export interface PublishedProps {
  pass: ReviewPass;
  /** now is the moment the time of the publication is told against; the present by default. */
  now?: number;
}

/** Published says what became of a pass that was sent to GitHub: its verdict, when, and the review there. */
export function Published({ pass, now = Date.now() }: PublishedProps) {
  return (
    <div className="mb-(--space-3) flex items-center gap-(--space-2) text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
      <span>{`Published · ${verdictLabel(pass.verdict)} · ${readMoment(pass.publishedAt, now)}`}</span>
      {pass.publishedUrl !== "" && (
        <Button variant="ghost" size="xs" onClick={() => void openExternal(pass.publishedUrl)}>
          Open on GitHub
        </Button>
      )}
    </div>
  );
}

export interface ReportsPanelProps {
  review: ReviewSummary;
}

/**
 * ReportsPanel is what the review has written, next to the conversation: the context the agent was
 * given and the report of each pass. A report opens in place of the list, with the way back to it.
 * A marker of the conversation or a pass in Details asks for the one it names.
 */
export function ReportsPanel({ review }: ReportsPanelProps) {
  const openPanel = useAppStore((state) => state.openPanel);
  const asked = useAppStore((state) => state.panelDocument);
  const clearPanelDocument = useAppStore((state) => state.clearPanelDocument);
  const passes = (review.passes ?? []).filter((pass) => pass.recorded);
  const [selection, setSelection] = useState<Selection>(() => selectionOf(asked, passes));
  // The last document opened is the row the focus returns to on the way back.
  const [last, setLast] = useState<Selection | null>(() =>
    asked === null ? null : selectionOf(asked, passes),
  );
  const backRef = useRef<HTMLButtonElement>(null);

  // A document asked for opens, also with the panel already open.
  useEffect(() => {
    if (asked !== null) {
      const next = selectionOf(asked, passes);
      setSelection(next);
      setLast(next);
      clearPanelDocument();
    }
  }, [asked, passes, clearPanelDocument]);

  const open = isPass(selection)
    ? (passes.find((pass) => pass.pass === selection.pass) ?? null)
    : null;
  // A report the review no longer has falls back to the list it came from.
  const view: Selection = isPass(selection) && open === null ? "list" : selection;
  const name = view === "list" ? null : open === null ? CONTEXT_FILE : open.file;
  // The context is written again with every pass asked for, before its report.
  const artifact = useReviewArtifact(
    review.id,
    name,
    open?.revision ?? (review.passes ?? []).length,
  );

  // The way back takes the focus as a document opens.
  useEffect(() => {
    if (view !== "list") {
      backRef.current?.focus();
    }
  }, [view]);

  const isLast = (candidate: Selection) =>
    last !== null &&
    (isPass(candidate) ? isPass(last) && last.pass === candidate.pass : last === candidate);
  const pick = (next: Selection) => {
    setSelection(next);
    setLast(next);
  };

  return (
    <AuxPanel id="reports" title="Reports" onClose={() => openPanel(null)}>
      <div className="flex flex-col gap-(--space-3) px-(--space-4) pt-(--space-3) pb-(--space-6)">
        {view === "list" ? (
          <ul className="flex flex-col">
            <li>
              <PanelRow
                glyph={<Icon icon={ICONS.file} size="sm" />}
                onClick={() => pick("context")}
                focusOnMount={isLast("context")}
              >
                Context
              </PanelRow>
            </li>
            {passes.map((pass) => (
              <li key={pass.pass}>
                <PanelRow
                  glyph={<Icon icon={ICONS.file} size="sm" />}
                  onClick={() => pick({ pass: pass.pass })}
                  focusOnMount={isLast({ pass: pass.pass })}
                >
                  {reportLabel(pass)}
                </PanelRow>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-(--space-2)">
              <Button ref={backRef} variant="ghost" size="xs" onClick={() => setSelection("list")}>
                ← Reports
              </Button>
              <h3 className="min-w-0 truncate font-semibold text-ink-1">
                {open === null ? "Context" : reportLabel(open)}
              </h3>
            </div>
            {artifact.status === "loading" && (
              <Skeleton label="Reading the report">
                {LOADING_WIDTHS.map((width) => (
                  <SkeletonBar key={width} className={width} />
                ))}
              </Skeleton>
            )}
            {artifact.status === "error" && (
              <NoticeStrip
                title="Couldn't read the report"
                reason={artifact.error}
                className="bg-state-error-veil"
              />
            )}
            {artifact.status === "ready" && (
              <div className="select-text">
                {open?.published === true && <Published pass={open} />}
                <Markdown className="ui-headings">{artifact.content}</Markdown>
              </div>
            )}
          </>
        )}
      </div>
    </AuxPanel>
  );
}
