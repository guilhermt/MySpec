import type { RelationGroup } from "@/components/system/RelationList";
import { prStateLabel, stateLabel } from "@/lib/boards";
import {
  asIssueState,
  asPullRequestState,
  type BoardCard,
  type CardIssue,
  type TaskCard,
} from "@/lib/wails";
import type { BoardCardReading } from "@/store/app-store";

/** OUT_OF_READING is what the strip says for each case the last reading of the board has no card for. */
const OUT_OF_READING = {
  missing: "The board of this card was removed.",
  unread: "The board hasn't been read yet.",
  card: "This card isn't in the last reading of the board.",
} as const;

/** noticeOf is why the panel shows only what the task keeps of its card, null when the reading has it. */
export function noticeOf(reading: BoardCardReading): string | null {
  if (reading.board !== "read") {
    return OUT_OF_READING[reading.board];
  }
  return reading.card === null ? OUT_OF_READING.card : null;
}

/** referenceOf names an issue or a pull request: #412, with its repository when it is another one. */
export function referenceOf(
  item: { repository: string; number: number },
  repository: string,
): string {
  return item.repository === repository ? `#${item.number}` : `${item.repository}#${item.number}`;
}

/** epicGroup is the epic of a card, as its group of one relation; the task keeps no state of it. */
function epicGroup(
  epic: CardIssue | null,
  repository: string,
  boardCards: ReadonlySet<string>,
): RelationGroup {
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
              ...(boardCards.has(epic.key) ? { cardKey: epic.key } : {}),
            },
          ],
  };
}

/**
 * relationsOf is everything the last reading found around a card, each group only with items. A
 * relation that is a card of the reading (its key is in boardCards) carries its cardKey.
 */
export function relationsOf(card: BoardCard, boardCards: ReadonlySet<string>): RelationGroup[] {
  const siblings = card.siblings ?? [];
  return [
    epicGroup(card.epic, card.repository, boardCards),
    {
      label: `Cards of the epic · ${siblings.length}`,
      items: siblings.map((sibling) => ({
        key: sibling.key,
        number: referenceOf(sibling, card.repository),
        title: sibling.title,
        meta: sibling.status !== "" ? sibling.status : stateLabel(asIssueState(sibling.state)),
        url: sibling.url,
        ...(sibling.onBoard && boardCards.has(sibling.key) ? { cardKey: sibling.key } : {}),
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
        ...(dependency.onBoard && boardCards.has(dependency.key)
          ? { cardKey: dependency.key }
          : {}),
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
export interface CardView {
  repository: string;
  number: number;
  url: string;
  status: string;
  title: string;
  body: string;
  relations: RelationGroup[];
}

/** cardViewOf is the card of the last reading, or what the task keeps of it outside that reading. */
export function cardViewOf(
  kept: TaskCard,
  read: BoardCard | null,
  boardCards: ReadonlySet<string>,
): CardView {
  if (read === null) {
    return {
      repository: kept.repository,
      number: kept.number,
      url: kept.url,
      status: kept.status,
      title: kept.title,
      body: "",
      relations: [epicGroup(kept.epic, kept.repository, boardCards)],
    };
  }
  return {
    repository: read.repository,
    number: read.number,
    url: read.url,
    status: read.status,
    title: read.title,
    body: read.body,
    relations: relationsOf(read, boardCards),
  };
}
