import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Markdown } from "@/features/chat/Markdown";
import { useDiscussionArtifact } from "@/features/discussion/useDiscussionArtifact";
import { Banner } from "@/features/notice/Notice";
import type { DiscussionSummary } from "@/lib/wails";

const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

/** CONTEXT_FILE is the document the app writes for the agent when the discussion starts. */
const CONTEXT_FILE = "context.md";

/** DOCUMENT_FILE is the document the agent writes about the demand. */
const DOCUMENT_FILE = "discussion.md";

/** Tab is the document the panel is showing. */
type Tab = "context" | "document";

export interface DocumentsPanelProps {
  discussion: DiscussionSummary;
}

/** DocumentsPanel is what the discussion was given and what it has written, next to the conversation. */
export function DocumentsPanel({ discussion }: DocumentsPanelProps) {
  const [tab, setTab] = useState<Tab>(discussion.hasDocument ? "document" : "context");
  const [dismissed, setDismissed] = useState("");

  // The document is the one worth reading as soon as the agent writes it; the
  // user is free from there on.
  useEffect(() => {
    if (discussion.hasDocument) {
      setTab("document");
    }
  }, [discussion.hasDocument]);

  const document = tab === "document" && discussion.hasDocument;
  // The context is written once, when the discussion is created.
  const artifact = useDiscussionArtifact(
    discussion.id,
    document ? DOCUMENT_FILE : CONTEXT_FILE,
    document ? discussion.documentRevision : 0,
  );

  return (
    <section className="flex h-full min-w-0 flex-col bg-background">
      <header className="flex h-9 shrink-0 items-center border-b px-3">
        <ToggleGroup
          aria-label="Documents"
          size="sm"
          value={[document ? "document" : "context"]}
          onValueChange={(next: string[]) => {
            const [value] = next;
            if (value === "context" || value === "document") {
              setTab(value);
            }
          }}
        >
          <ToggleGroupItem value="context">Context</ToggleGroupItem>
          <ToggleGroupItem value="document" disabled={!discussion.hasDocument}>
            Document
          </ToggleGroupItem>
        </ToggleGroup>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {artifact.status === "loading" && (
          <div className="flex flex-col gap-3">
            {LOADING_WIDTHS.map((width) => (
              <Skeleton key={width} className={`h-4 ${width}`} />
            ))}
          </div>
        )}
        {artifact.status === "error" && artifact.error !== dismissed && (
          <Banner
            className="bg-destructive/10"
            title="Couldn't read the document"
            onDismiss={() => setDismissed(artifact.error)}
          >
            {artifact.error}
          </Banner>
        )}
        {artifact.status === "ready" && (
          <div className="max-w-[58.5rem] select-text">
            <Markdown>{artifact.content}</Markdown>
          </div>
        )}
      </div>
    </section>
  );
}
