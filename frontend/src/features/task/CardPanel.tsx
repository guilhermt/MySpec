import { useMemo } from "react";
import { AuxPanel } from "@/components/system/AuxPanel";
import { Link } from "@/components/system/Link";
import { LiveRegion } from "@/components/system/LiveRegion";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { RelationList } from "@/components/system/RelationList";
import { Markdown } from "@/features/chat/Markdown";
import { cardViewOf, noticeOf } from "@/features/task/card-panel";
import type { TaskSummary } from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { useAppStore, useBoard, useBoardCard } from "@/store/app-store";

const NO_KEYS: ReadonlySet<string> = new Set();

export interface CardPanelProps {
  task: TaskSummary;
}

/**
 * CardPanel is the card a task was created from, as the last reading of its board has it: the
 * reference, the status and the way to GitHub, the title, the body and its relations, each an
 * external link. Outside that reading, a strip says why, and the panel shows what the task keeps.
 */
export function CardPanel({ task }: CardPanelProps) {
  const openPanel = useAppStore((state) => state.openPanel);
  const openBoardCard = useAppStore((state) => state.openBoardCard);
  const board = useBoard(task.card?.boardId ?? "");
  const cards = board?.cards;
  const boardCards = useMemo(
    () => (cards === undefined || cards === null ? NO_KEYS : new Set(cards.map((c) => c.key))),
    [cards],
  );
  const reading = useBoardCard(task.card?.boardId ?? "", task.card?.key ?? "");
  if (task.card === null) {
    return null;
  }
  const notice = noticeOf(reading);
  const card = cardViewOf(task.card, reading.card, boardCards);

  return (
    <AuxPanel id="card" title={`Card #${task.card.number}`} onClose={() => openPanel(null)}>
      <div className="flex flex-col gap-(--space-4) px-(--space-4) pt-(--space-3) pb-(--space-6)">
        <LiveRegion kind="status" className="contents">
          {notice !== null && <NoticeStrip title={notice} outlined />}
        </LiveRegion>
        <div className="flex flex-col gap-(--space-1)">
          <div className="flex min-w-0 flex-wrap items-center gap-x-(--space-2)">
            <span className="font-mono text-ink-2">{`${card.repository}#${card.number}`}</span>
            {card.status !== "" && <span className="text-ink-3">{card.status}</span>}
            <Link
              href={card.url}
              external
              onClick={(event) => {
                event.preventDefault();
                void openExternal(card.url);
              }}
              className="ml-auto"
            >
              Open on GitHub
            </Link>
          </div>
          <h3 className="text-(length:--text-ui) leading-(--leading-ui) font-semibold text-ink-1">
            {card.title}
          </h3>
        </div>
        {card.body !== "" && (
          <div className="select-text">
            <Markdown className="ui-headings">{card.body}</Markdown>
          </div>
        )}
        <RelationList
          groups={card.relations}
          onOpen={(url) => void openExternal(url)}
          onOpenCard={(key) => {
            const boardId = task.card?.boardId ?? "";
            if (boardId !== "") {
              openBoardCard(boardId, key);
            }
          }}
        />
      </div>
    </AuxPanel>
  );
}
