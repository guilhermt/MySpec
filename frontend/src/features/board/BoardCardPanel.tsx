import { type MouseEvent, type Ref, useEffect, useMemo, useRef } from "react";
import { DependencyNotice } from "@/components/system/DependencyNotice";
import { Icon } from "@/components/system/Icon";
import { ItemBlock } from "@/components/system/ItemBlock";
import { ICONS } from "@/components/system/icons";
import { Link } from "@/components/system/Link";
import { ListPanel } from "@/components/system/ListPanel";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { RelationList } from "@/components/system/RelationList";
import { epicChildren } from "@/features/board/board-view";
import { CardActions } from "@/features/board/CardActions";
import { cardPanelModel, outOfReadingText } from "@/features/board/card-panel";
import type { StartCard } from "@/features/board/useStartCard";
import { Markdown } from "@/features/chat/Markdown";
import { taskRow } from "@/features/sidebar/sidebar-tree";
import type { Board, BoardCard, TaskSummary } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { useAppStore, useRepository } from "@/store/app-store";

export interface BoardCardPanelProps {
  board: Board;
  card: BoardCard;
  /** outOfReading is a card the last reading of the board no longer has. */
  outOfReading: boolean;
  start: StartCard;
  now: number;
  onClose: () => void;
  /** onOpenCard opens a card of the reading in this panel, with its row in view. */
  onOpenCard: (key: string) => void;
  /** onDiscuss opens a discussion of this card alone. */
  onDiscuss: () => void;
  /** panelRef is the panel, which the board reads to tell whether the focus is inside it. */
  panelRef?: Ref<HTMLElement>;
}

const STRIP_ID = "card-out-of-reading";

/** asLink is the click of a link that has no page: the caller does what it says. */
function asLink(run: () => void) {
  return {
    href: "#",
    onClick: (event: MouseEvent) => {
      event.preventDefault();
      run();
    },
  };
}

/**
 * BoardCardPanel is the panel of the card open in the board: its title and status, the actions of
 * its case, the warnings, the task and the discussions it is in, its fields, its description and its
 * relations.
 */
export function BoardCardPanel({
  board,
  card,
  outOfReading,
  start,
  now,
  onClose,
  onOpenCard,
  onDiscuss,
  panelRef,
}: BoardCardPanelProps) {
  const app = useAppStore((state) => state.app);
  const openTask = useAppStore((state) => state.openTask);
  const openArchived = useAppStore((state) => state.openArchived);
  const openDiscussion = useAppStore((state) => state.openDiscussion);
  const openArchivedDiscussion = useAppStore((state) => state.openArchivedDiscussion);
  const pendingStart = useAppStore((state) => state.pendingStart);
  const repository = useRepository(card.repositoryId);
  const children = useMemo(() => epicChildren(board.cards ?? []), [board.cards]);
  // Add to board, once done, leaves the focus on the primary the reading brings for the card.
  const focusAfterAdd = useRef(false);

  useEffect(() => {
    if (!focusAfterAdd.current || card.action === "add_to_board") {
      return;
    }
    focusAfterAdd.current = false;
    if (card.action === "start" || card.action === "clone") {
      document.querySelector<HTMLElement>(".list-panel [data-primary]")?.focus();
    }
  }, [card]);

  if (app === null) {
    return null;
  }
  const model = cardPanelModel(card, {
    app,
    board,
    children,
    clone: {
      cloning: repository?.cloning === true,
      error: (repository?.cloneError ?? "") !== "" ? (repository?.cloneError ?? "") : start.error,
      opensDialog: pendingStart?.key === card.key,
    },
    outOfReading,
  });
  const task: TaskSummary | undefined =
    model.task?.kind === "active"
      ? (app.tasks ?? []).find((candidate) => candidate.id === model.task?.taskId)
      : undefined;
  const row = task === undefined ? null : taskRow(app, task, now);

  return (
    <ListPanel
      label={`Card #${card.number}`}
      number={model.head.number}
      repository={model.head.repository}
      url={card.url}
      onOpenExternal={(url) => void openExternal(url)}
      onClose={onClose}
      scrollKey={card.key}
      {...(panelRef === undefined ? {} : { panelRef })}
    >
      <div className="flex flex-col gap-(--space-4) px-(--space-4) pt-(--space-3) pb-(--space-6)">
        {outOfReading && (
          <NoticeStrip
            id={STRIP_ID}
            outlined
            role="status"
            title="This card isn't in the last reading of the board."
            reason={outOfReadingText(board, now)}
          />
        )}
        <div className="flex flex-col gap-(--space-1)">
          <h2 className="text-(length:--text-title) leading-(--leading-title) font-semibold text-ink-1">
            {model.title}
          </h2>
          <p className="text-ink-3">
            <span className="font-medium text-ink-2">{model.status.name}</span>
            {model.status.closed && " · Closed"}
            {model.status.epic !== null && ` · ${model.status.epic}`}
          </p>
        </div>
        <CardActions
          board={board}
          card={card}
          actions={model.actions}
          start={start}
          stripId={outOfReading ? STRIP_ID : null}
          onAdded={() => {
            focusAfterAdd.current = true;
          }}
          onDiscuss={onDiscuss}
        />
        {model.dependencies.map((dependency) => (
          <DependencyNotice key={dependency.key} model={dependency} outlined />
        ))}
        {model.task?.kind === "active" && row !== null && (
          <ItemBlock
            kind={row.itemKind}
            name={row.name}
            line2={{ tone: row.tone, text: row.line2.long }}
            clock={row.clock}
            openLabel="Open the task"
            onOpen={() => openTask(model.task?.taskId ?? "")}
          />
        )}
        {model.task?.kind === "archived" && (
          <div>
            {"Archived task: "}
            <Link {...asLink(() => openArchived(model.task?.taskId ?? ""))}>{model.task.name}</Link>
          </div>
        )}
        {model.discussions.length > 0 && (
          <ul className="flex flex-col gap-(--space-1)">
            {model.discussions.map((discussion) => (
              <li key={discussion.id}>
                <Link
                  {...asLink(() =>
                    discussion.archived
                      ? openArchivedDiscussion(discussion.id)
                      : openDiscussion(discussion.id),
                  )}
                  className="gap-(--space-1-5)"
                >
                  <Icon icon={ICONS.discussion} size="sm" />
                  {`${discussion.archived ? "From" : "In"} the discussion ${discussion.title}`}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {model.fields.length > 0 && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-(--space-4) gap-y-(--space-1) text-(length:--text-meta) leading-(--leading-meta)">
            {model.fields.map((field) => (
              <div key={field.key} className="contents">
                <dt className="text-ink-3">{field.key}</dt>
                <dd className="text-ink-1">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="border-t border-line-1 pt-(--space-4)">
          {model.body === "" ? (
            <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
              No description.
            </p>
          ) : (
            <Markdown className="card-body ui-headings">{model.body}</Markdown>
          )}
        </div>
        <RelationList
          groups={model.relations}
          onOpen={(url) => void openExternal(url)}
          onOpenCard={onOpenCard}
        />
      </div>
    </ListPanel>
  );
}
