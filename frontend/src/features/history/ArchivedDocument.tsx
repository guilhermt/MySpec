import { type ReactNode, useState } from "react";
import { Button } from "@/components/system/Button";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { Markdown } from "@/features/chat/Markdown";
import { useArtifact } from "@/features/task/useArtifact";

/** LOADING_WIDTHS are the three lines of the skeleton of a document being read. */
const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

export interface ArchivedDocumentProps {
  taskId: string;
  /** name is the document to read; null when the task has none, which says `empty`. */
  name: string | null;
  artifactVersion: number;
  /** empty is what the place of a document the task doesn't have says. */
  empty: string;
  /** render draws the text read; by default Markdown with its headings at the size of the UI, under the title of the place. */
  render?: (content: string) => ReactNode;
}

/**
 * ArchivedDocument is one document of an archived task read in place: three shimmering lines while it
 * is read, the text, or a strip with the reason and Try again when the read failed.
 */
export function ArchivedDocument({
  taskId,
  name,
  artifactVersion,
  empty,
  render,
}: ArchivedDocumentProps) {
  const [attempt, setAttempt] = useState(0);
  const artifact = useArtifact(taskId, name, artifactVersion + attempt);

  if (name === null) {
    return <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">{empty}</p>;
  }
  if (artifact.status === "error") {
    return (
      <NoticeStrip
        role="alert"
        title={`Couldn't read ${name}`}
        reason={artifact.error}
        action={
          <Button variant="ghost" size="sm" onClick={() => setAttempt((count) => count + 1)}>
            Try again
          </Button>
        }
      />
    );
  }
  if (artifact.status !== "ready") {
    return (
      <Skeleton label={`Reading ${name}`}>
        {LOADING_WIDTHS.map((width) => (
          <SkeletonBar key={width} className={width} />
        ))}
      </Skeleton>
    );
  }
  return (
    <div className="select-text">
      {render === undefined ? (
        <Markdown className="ui-headings">{artifact.content}</Markdown>
      ) : (
        render(artifact.content)
      )}
    </div>
  );
}
