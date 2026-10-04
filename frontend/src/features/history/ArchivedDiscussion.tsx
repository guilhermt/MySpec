import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/system/Collapsible";
import { CutText } from "@/components/system/CutText";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Link } from "@/components/system/Link";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { Tag } from "@/components/system/Tag";
import { Tooltip } from "@/components/system/Tooltip";
import { Conversation } from "@/features/chat/Conversation";
import type { DiscussionInput } from "@/features/chat/discussion-markers";
import { LINE, MarkerLine } from "@/features/chat/entries/MarkerLine";
import type { MarkerView } from "@/features/chat/markers";
import { IDLE_SESSION } from "@/features/chat/session";
import { DeleteDiscussionDialog } from "@/features/discussion/DeleteDiscussionDialog";
import { useDiscussionArtifact } from "@/features/discussion/useDiscussionArtifact";
import { ArchivedBody } from "@/features/history/ArchivedBody";
import { ArchivedFacts } from "@/features/history/ArchivedFacts";
import { ArchivedMarkers } from "@/features/history/ArchivedMarkers";
import { ArchivedMenu } from "@/features/history/ArchivedMenu";
import { ArchivedSection } from "@/features/history/ArchivedSection";
import { ArchivedTags } from "@/features/history/ArchivedTags";
import {
  archivedDiscussionFacts,
  type PublishedRow,
  publishedRows,
} from "@/features/history/archived";
import { historyEntries, historyNeighbor } from "@/features/history/history-list";
import { useArchivedItem } from "@/features/history/useArchivedItem";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { isMissingFile } from "@/lib/errors";
import { olderKey } from "@/lib/history";
import { counted } from "@/lib/situations";
import { cn } from "@/lib/utils";
import { DISCUSSION_STAGE } from "@/lib/wails";
import { loadTranscript, openExternal } from "@/store/actions";
import { useAppStore, useBoard, useTranscript } from "@/store/app-store";

/** DOCUMENT_FILE is the document the agent wrote about the demand. */
const DOCUMENT_FILE = "discussion.md";

// PublishedLine is a draft of the discussion: its kind, its title and what became of it.
function PublishedLine({ row }: { row: PublishedRow }) {
  const { outcome } = row;
  return (
    <li
      className={cn(
        "flex min-h-(--size-control) items-center gap-(--space-3) border-t border-line-1 px-(--space-3) py-(--space-1) first:border-t-0",
        row.indented && "pl-[calc(var(--space-3)+var(--epic-indent))]",
      )}
    >
      <Tag className="shrink-0">{row.label}</Tag>
      <CutText
        text={row.title}
        className={cn(
          "min-w-0 flex-1 text-(length:--text-ui) leading-(--leading-ui)",
          outcome.kind === "link" ? "text-ink-1" : "text-ink-2",
        )}
      />
      {outcome.kind === "link" ? (
        <Tooltip content={outcome.tooltip}>
          <Link
            href={outcome.href}
            external
            className="shrink-0 text-(length:--text-meta) leading-(--leading-meta)"
            onClick={(event) => {
              event.preventDefault();
              void openExternal(outcome.href);
            }}
          >
            {outcome.text}
          </Link>
        </Tooltip>
      ) : (
        <span className="shrink-0 text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          {outcome.text}
        </span>
      )}
    </li>
  );
}

// ConversationLine is the line that opens the whole conversation, read only, under the lines of the
// documents: a stop of the walk, with the state of the fold.
function ConversationLine({ complement }: { complement: string }) {
  return (
    <article data-feed-entry aria-label={`Conversation · ${complement}`} className="flex flex-col">
      <CollapsibleTrigger
        chevronSize="xs"
        data-feed-item
        data-feed-toggle
        tabIndex={-1}
        className={cn(
          LINE,
          "outline-none transition-colors duration-(--duration-fast) ease-standard hover:bg-veil-hover active:bg-veil-press focus-visible:focus-ring",
        )}
      >
        <Icon icon={ICONS.discussion} size="sm" className="text-ink-4" />
        <span className="shrink-0 font-medium whitespace-nowrap text-ink-2">Conversation</span>
        <CutText text={complement} className="text-ink-3" />
      </CollapsibleTrigger>
    </article>
  );
}

export interface ArchivedDiscussionProps {
  discussionId: string;
}

/**
 * ArchivedDiscussion is a discussion that is over, as History keeps it: what it published, the
 * document it wrote and the whole conversation, read only. Nothing runs; going back and deleting are
 * what is left.
 */
export function ArchivedDiscussion({ discussionId }: ArchivedDiscussionProps) {
  const discussion = useArchivedItem("discussion", discussionId);
  const board = useBoard(discussion?.boardId ?? "");
  const go = useAppStore((state) => state.go);
  const transcript = useTranscript(discussionId, DISCUSSION_STAGE);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [neighbor, setNeighbor] = useState<string | null>(null);
  const [conversationOpen, setConversationOpen] = useState(false);
  // The document never changes again, so it is read once, at revision zero, and again on Try again.
  const [attempt, setAttempt] = useState(0);
  const artifact = useDiscussionArtifact(discussionId, DOCUMENT_FILE, 0, attempt);

  // The conversation of a discussion of History is fetched when it opens; nothing arrives after that.
  useEffect(() => {
    void loadTranscript(discussionId, DISCUSSION_STAGE);
  }, [discussionId]);

  // The rounds fold in the archived conversation too, and its document is the archived file.
  const input = useMemo<DiscussionInput | null>(
    () =>
      discussion === null
        ? null
        : {
            id: discussion.id,
            drafts: discussion.drafts ?? [],
            text: discussion.text,
            cards: discussion.cards ?? [],
            documentRevision: 0,
            documents: false,
          },
    [discussion],
  );

  if (discussion === null || input === null) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1">
        <LocationHeader />
        <ArchivedBody>
          <Skeleton label="Reading the discussion">
            <SkeletonBar className="w-1/2" />
            <SkeletonBar className="w-full" />
            <SkeletonBar className="w-3/4" />
          </Skeleton>
        </ArchivedBody>
      </section>
    );
  }

  const now = Date.now();
  const rows = publishedRows(discussion);
  // A document that is not there, or empty, is a discussion that never wrote one; one that is there
  // and cannot be read says the failure in place of its line.
  const failed = artifact.status === "error" && !isMissingFile(artifact.error);
  const written =
    artifact.status === "loading" ||
    (artifact.status === "ready" && artifact.content.trim() !== "");
  const documentView: MarkerView = written
    ? {
        icon: "file",
        text: DOCUMENT_FILE,
        complement: "the understanding",
        body: { kind: "discussionDocument", name: DOCUMENT_FILE, text: null },
        timeHidden: true,
      }
    : {
        icon: "file",
        text: "No document was written.",
        complement: "",
        body: { kind: "none" },
        timeHidden: true,
      };
  const read = transcript?.status === "ready";
  const complement = read
    ? `${counted(transcript.entries.length, "message")}, read only`
    : "read only";

  // The entries History shows, as of the moment the dialog opens: the row that takes the place of this one.
  const openDialog = () => {
    const { app, olderArchived, olderLists, historyQuery } = useAppStore.getState();
    const filter = app?.repositoryFilter ?? "";
    const ids = olderLists[olderKey(historyQuery, filter)]?.ids ?? [];
    setNeighbor(
      historyNeighbor(
        historyEntries(app, { archived: olderArchived, ids }, historyQuery, filter, null),
        discussion.id,
      ),
    );
    setDeleting(true);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1">
      <LocationHeader
        lead={<Icon icon={ICONS.discussion} className="text-ink-3" />}
        progress={
          <ArchivedTags>
            <Tag>Archived</Tag>
          </ArchivedTags>
        }
      >
        {board !== null && (
          <Tooltip content="Open the board">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => go({ kind: "board", id: discussion.boardId })}
            >
              {board.title}
            </Button>
          </Tooltip>
        )}
        <ArchivedMenu tooltip="Delete from History" onDelete={openDialog} triggerRef={moreRef} />
      </LocationHeader>

      <ArchivedBody>
        <ArchivedFacts facts={archivedDiscussionFacts(discussion, now)} />

        {rows.length > 0 && (
          <ArchivedSection title="What it published">
            <ul className="rounded-md shadow-[inset_0_0_0_var(--border)_var(--line-1)]">
              {rows.map((row) => (
                <PublishedLine key={row.id} row={row} />
              ))}
            </ul>
          </ArchivedSection>
        )}

        <ArchivedSection title="Document and conversation">
          {failed && (
            <NoticeStrip
              title={`Couldn't read ${DOCUMENT_FILE}`}
              reason={artifact.error}
              className="bg-state-error-veil"
              action={
                <Button size="xs" onClick={() => setAttempt((count) => count + 1)}>
                  Try again
                </Button>
              }
            />
          )}
          <Collapsible open={conversationOpen} onOpenChange={setConversationOpen}>
            <ArchivedMarkers label="Document and conversation">
              {!failed && (
                <MarkerLine
                  view={documentView}
                  createdAt=""
                  discussion={{ id: discussion.id, documentRevision: 0, documents: false }}
                />
              )}
              <ConversationLine complement={complement} />
            </ArchivedMarkers>
            <CollapsibleContent>
              <div className="pt-(--space-2)">
                <Conversation
                  taskId={discussion.id}
                  stage={DISCUSSION_STAGE}
                  session={IDLE_SESSION}
                  discussion={input}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </ArchivedSection>
      </ArchivedBody>

      <DeleteDiscussionDialog
        discussion={{ id: discussion.id, title: discussion.title, drafts: discussion.drafts ?? [] }}
        archived
        neighbor={neighbor}
        open={deleting}
        onOpenChange={(open) => {
          setDeleting(open);
          if (!open) {
            moreRef.current?.focus();
          }
        }}
      />
    </section>
  );
}
