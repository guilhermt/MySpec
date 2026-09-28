import { AuxPanel } from "@/components/system/AuxPanel";
import { Link } from "@/components/system/Link";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { type RelationGroup, RelationList } from "@/components/system/RelationList";
import { Markdown } from "@/features/chat/Markdown";
import { prStateLabel, stateLabel } from "@/lib/boards";
import {
  asIssueState,
  asPullRequestState,
  type BoardCard,
  type CardIssue,
  type TaskCard,
  type TaskSummary,
} from "@/lib/wails";
import { openExternal } from "@/store/actions";
import { type BoardCardReading, useAppStore, useBoardCard } from "@/store/app-store";

/** OUT_OF_READING is what the strip says for each case the last reading of the board has no card for. */
const OUT_OF_READING = {
  missing: "The board of this card was removed.",
  unread: "The board hasn't been read yet.",
  card: "This card isn't in the last reading of the board.",
} as const;

/** noticeOf is why the panel shows only what the task keeps of its card, null when the reading has it. */
function noticeOf(reading: BoardCardReading): string | null {
  if (reading.board !== "read") {
    return OUT_OF_READING[reading.board];
  }
  return reading.card === null ? OUT_OF_READING.card : null;
}

/** referenceOf names an issue or a pull request: #412, with its repository when it is another one. */
function referenceOf(item: { repository: string; number: number }, repository: string): string {
  return item.repository === repository ? `#${item.number}` : `${item.repository}#${item.number}`;
}

/** epicGroup is the epic of a card, as its group of one relation; the task keeps no state of it. */
function epicGroup(epic: CardIssue | null, repository: string): RelationGroup {
  return {
    label: "Epic",
    items:
      epic === null
        ? []
        : [
            {
              key: epic.key,
              number: referenceOf(epic, repository),
              title: epic.title,
              meta: "",
              url: epic.url,
            },
          ],
  };
}

/** relationsOf is everything the last reading found around a card, each group only with items. */
function relationsOf(card: BoardCard): RelationGroup[] {
  const siblings = card.siblings ?? [];
  return [
    epicGroup(card.epic, card.repository),
    {
      label: `Cards of the epic · ${siblings.length}`,
      items: siblings.map((sibling) => ({
        key: sibling.key,
        number: referenceOf(sibling, card.repository),
        title: sibling.title,
        meta: sibling.status !== "" ? sibling.status : stateLabel(asIssueState(sibling.state)),
        url: sibling.url,
      })),
    },
    {
      label: "Dependencies",
      items: (card.dependencies ?? []).map((dependency) => ({
        key: dependency.key,
        number: referenceOf(dependency, card.repository),
        title: dependency.title,
        meta: stateLabel(asIssueState(dependency.state)),
        url: dependency.url,
        ...(dependency.satisfied ? {} : { warning: "Not satisfied" }),
      })),
    },
    {
      label: "Pull requests",
      // A linked pull request carries no title: its reference and its state say it.
      items: (card.pullRequests ?? []).map((pr) => ({
        key: pr.url,
        number: referenceOf(pr, card.repository),
        title: "",
        meta: prStateLabel(asPullRequestState(pr.state)),
        url: pr.url,
      })),
    },
  ];
}

/** CardView is what the panel draws of a card, from the reading or from what the task keeps. */
interface CardView {
  repository: string;
  number: number;
  url: string;
  status: string;
  title: string;
  body: string;
  relations: RelationGroup[];
}

/** cardViewOf is the card of the last reading, or what the task keeps of it outside that reading. */
function cardViewOf(kept: TaskCard, read: BoardCard | null): CardView {
  if (read === null) {
    return {
      repository: kept.repository,
      number: kept.number,
      url: kept.url,
      status: kept.status,
      title: kept.title,
      body: "",
      relations: [epicGroup(kept.epic, kept.repository)],
    };
  }
  return {
    repository: read.repository,
    number: read.number,
    url: read.url,
    status: read.status,
    title: read.title,
    body: read.body,
    relations: relationsOf(read),
  };
}

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
  const reading = useBoardCard(task.card?.boardId ?? "", task.card?.key ?? "");
  if (task.card === null) {
    return null;
  }
  const notice = noticeOf(reading);
  const card = cardViewOf(task.card, reading.card);

  return (
    <AuxPanel id="card" title={`Card #${task.card.number}`} onClose={() => openPanel(null)}>
      <div className="flex flex-col gap-(--space-4) px-(--space-4) pt-(--space-3) pb-(--space-6)">
        {notice !== null && <NoticeStrip title={notice} role="status" outlined />}
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
            <Markdown>{card.body}</Markdown>
          </div>
        )}
        <RelationList groups={card.relations} onOpen={(url) => void openExternal(url)} />
      </div>
    </AuxPanel>
  );
}
