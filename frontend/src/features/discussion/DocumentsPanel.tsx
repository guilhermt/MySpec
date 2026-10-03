import { useEffect, useState } from "react";
import { AuxPanel } from "@/components/system/AuxPanel";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { PanelRow } from "@/components/system/PanelRow";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { Markdown } from "@/features/chat/Markdown";
import { useDiscussionArtifact } from "@/features/discussion/useDiscussionArtifact";
import type { DiscussionSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";

/** LOADING_WIDTHS are the three bars of the skeleton while a document is read. */
const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

/** DOCUMENTS are the documents of a discussion, in the order of the list. */
const DOCUMENTS = [
  { name: "context.md", label: "Context" },
  { name: "discussion.md", label: "Document" },
] as const;

type DocumentName = (typeof DOCUMENTS)[number]["name"];

// documentNamed is the document a marker or a row of Details asked the panel to open at, if it names one.
function documentNamed(file: string | null): DocumentName | null {
  return DOCUMENTS.find((document) => document.name === file)?.name ?? null;
}

export interface DocumentsPanelProps {
  discussion: DiscussionSummary;
}

/**
 * DocumentsPanel is what the discussion was given and what it has written, next to the conversation:
 * the list of the two documents and the one chosen, read. It opens on the document asked for, or on
 * the document of the agent once there is one and on the context before; open, it never changes the
 * choice by itself.
 */
export function DocumentsPanel({ discussion }: DocumentsPanelProps) {
  const openPanel = useAppStore((state) => state.openPanel);
  const asked = useAppStore((state) => state.panelDocument);
  const clearPanelDocument = useAppStore((state) => state.clearPanelDocument);
  const [chosen, setChosen] = useState<DocumentName>(
    () => documentNamed(asked) ?? (discussion.hasDocument ? "discussion.md" : "context.md"),
  );
  const [attempt, setAttempt] = useState(0);

  // A document asked for opens, also with the panel already open.
  useEffect(() => {
    const name = documentNamed(asked);
    if (name !== null) {
      setChosen(name);
    }
    if (asked !== null) {
      clearPanelDocument();
    }
  }, [asked, clearPanelDocument]);

  const artifact = useDiscussionArtifact(
    discussion.id,
    chosen,
    chosen === "discussion.md" ? discussion.documentRevision : 0,
    attempt,
  );

  return (
    <AuxPanel id="documents" title="Documents" onClose={() => openPanel(null)}>
      <div className="flex flex-col gap-(--space-3) px-(--space-4) pt-(--space-3) pb-(--space-6)">
        <ul className="flex flex-col">
          {DOCUMENTS.map((document) => (
            <li key={document.name}>
              <PanelRow
                glyph={<Icon icon={ICONS.file} size="sm" />}
                {...(document.name === "discussion.md" && !discussion.hasDocument
                  ? {}
                  : { pressed: document.name === chosen, onClick: () => setChosen(document.name) })}
              >
                {document.label}
              </PanelRow>
            </li>
          ))}
        </ul>
        {artifact.status === "loading" && (
          <Skeleton label="Reading the document">
            {LOADING_WIDTHS.map((width) => (
              <SkeletonBar key={width} className={width} />
            ))}
          </Skeleton>
        )}
        {artifact.status === "error" && (
          <NoticeStrip
            title="Couldn't read the document"
            reason={artifact.error}
            className="bg-state-error-veil"
            action={
              <Button size="xs" onClick={() => setAttempt((count) => count + 1)}>
                Try again
              </Button>
            }
          />
        )}
        {artifact.status === "ready" && (
          <div className="select-text">
            <Markdown>{artifact.content}</Markdown>
          </div>
        )}
      </div>
    </AuxPanel>
  );
}
