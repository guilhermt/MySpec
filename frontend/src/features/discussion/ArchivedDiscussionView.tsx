import { ExternalLink, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { pluralize } from "@/features/boards/board-dialog";
import { Conversation } from "@/features/chat/Conversation";
import { Markdown } from "@/features/chat/Markdown";
import type { SessionState } from "@/features/chat/session";
import { DeleteDiscussionDialog } from "@/features/discussion/DeleteDiscussionDialog";
import {
  epicGroups,
  kindLabel,
  looseDrafts,
  outcomeLabel,
} from "@/features/discussion/discussion-status";
import { useDiscussionArtifact } from "@/features/discussion/useDiscussionArtifact";
import { formatDates } from "@/features/history/history-format";
import { cn } from "@/lib/utils";
import { DISCUSSION_STAGE, type Draft } from "@/lib/wails";
import { loadTranscript, openExternal } from "@/store/actions";
import { useAppStore, useArchivedDiscussion } from "@/store/app-store";

const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

/** DOCUMENT_FILE is the document the agent wrote about the demand. */
const DOCUMENT_FILE = "discussion.md";

/** ARCHIVED_SESSION is a session that is over: nothing runs behind the conversation. */
const ARCHIVED_SESSION: SessionState = {
  sessionStatus: "waiting",
  sessionModel: "",
  sessionEffort: "",
  turnRunning: false,
  processRunning: false,
  retryAttempt: 0,
};

/** DraftLine is one draft of the archived discussion: what it was, and what became of it. */
function DraftLine({ draft, indented }: { draft: Draft; indented?: boolean }) {
  return (
    <li className={cn("flex items-center gap-2 px-2 py-1.5 text-sm", indented && "pl-6")}>
      <Badge variant="outline" className="shrink-0">
        {kindLabel(draft)}
      </Badge>
      <span className="min-w-0 truncate">{draft.title}</span>
      <span className="flex-1" />
      <span className="shrink-0 text-xs text-muted-foreground">{outcomeLabel(draft)}</span>
      {draft.published && (
        <button
          type="button"
          onClick={() => void openExternal(draft.url)}
          className="flex shrink-0 items-center gap-0.5 rounded-md text-xs text-muted-foreground tabular-nums transition-colors hover:text-foreground"
        >
          {`${draft.repository}#${draft.number}`}
          <ExternalLink aria-hidden="true" className="size-3" />
        </button>
      )}
    </li>
  );
}

/** Drafts lists what the discussion drafted, the cards of an epic under it. */
function Drafts({ drafts }: { drafts: readonly Draft[] }) {
  const groups = epicGroups(drafts).map((group) => ({ position: group.epic.position, group }));
  const loose = looseDrafts(drafts).map((draft) => ({ position: draft.position, draft }));
  const lines = [...groups, ...loose].sort((a, b) => a.position - b.position);

  return (
    <ul className="flex flex-col gap-1">
      {lines.map((line) =>
        "group" in line ? (
          <li key={line.group.epic.id}>
            <ul aria-label={`Epic ${line.group.epic.title}`} className="rounded-lg border">
              <DraftLine draft={line.group.epic} />
              {line.group.members.map((member) => (
                <DraftLine key={member.id} draft={member} indented />
              ))}
            </ul>
          </li>
        ) : (
          <DraftLine key={line.draft.id} draft={line.draft} />
        ),
      )}
    </ul>
  );
}

export interface ArchivedDiscussionViewProps {
  discussionId: string;
}

/**
 * ArchivedDiscussionView is a discussion that is over, as the history keeps it:
 * the document it wrote, the drafts it decided and the conversation that got
 * there. Only going back and deleting are left.
 */
export function ArchivedDiscussionView({ discussionId }: ArchivedDiscussionViewProps) {
  const discussion = useArchivedDiscussion(discussionId);
  const closeArchivedDiscussion = useAppStore((state) => state.closeArchivedDiscussion);
  const [deleting, setDeleting] = useState(false);
  // The document never changes again, so it is read once, at revision zero.
  const artifact = useDiscussionArtifact(discussionId, DOCUMENT_FILE, 0);

  // The conversation of a discussion of the history is fetched when it opens;
  // nothing arrives after that.
  useEffect(() => {
    void loadTranscript(discussionId, DISCUSSION_STAGE);
  }, [discussionId]);

  if (discussion === null) {
    return <section className="h-dvh bg-background" />;
  }

  const drafts = discussion.drafts ?? [];
  // A document that is not there, or that cannot be read, is a discussion that
  // never wrote one.
  const written = artifact.status === "ready" && artifact.content.trim() !== "";

  return (
    <section className="flex h-dvh min-w-0 flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="sm" onClick={() => closeArchivedDiscussion()}>
          ← History
        </Button>
        <Badge variant="outline">Discussion</Badge>
        <span className="min-w-0 truncate font-medium">{discussion.title}</span>
        <Badge variant="secondary">{discussion.board}</Badge>

        <span className="flex-1" />

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete discussion"
          onClick={() => setDeleting(true)}
        >
          <Trash2 />
        </Button>

        <DeleteDiscussionDialog
          discussion={discussion}
          open={deleting}
          onOpenChange={setDeleting}
        />
      </header>

      <div className="flex h-9 shrink-0 items-center gap-3 border-b px-3 text-xs text-muted-foreground">
        <span className="shrink-0">{formatDates(discussion.createdAt, discussion.archivedAt)}</span>
        <span className="shrink-0">
          {`${pluralize(discussion.publishedCount, "card")} published`}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex max-w-[58.5rem] flex-col gap-8">
          <article aria-label="Document" className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Document</h2>
            {artifact.status === "loading" ? (
              <div className="flex flex-col gap-3">
                {LOADING_WIDTHS.map((width) => (
                  <Skeleton key={width} className={`h-4 ${width}`} />
                ))}
              </div>
            ) : written ? (
              <div className="select-text">
                <Markdown>{artifact.content}</Markdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No document was written.</p>
            )}
          </article>

          {drafts.length > 0 && (
            <section aria-label="Drafts" className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">Drafts</h2>
              <Drafts drafts={drafts} />
            </section>
          )}

          <section aria-label="Conversation" className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Conversation</h2>
            <Conversation
              taskId={discussion.id}
              stage={DISCUSSION_STAGE}
              session={ARCHIVED_SESSION}
            />
          </section>
        </div>
      </div>
    </section>
  );
}
