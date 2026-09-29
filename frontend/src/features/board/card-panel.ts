import type { RelationItem } from "@/components/system/RelationList";
import {
  type EpicChild,
  epicProgress,
  inDiscussion,
  isCheckable,
  unsatisfied,
} from "@/features/board/board-view";
import { referenceOf } from "@/features/task/card-panel";
import { prStateLabel, stateLabel } from "@/lib/boards";
import { findRepository } from "@/lib/repositories";
import {
  asIssueState,
  asPullRequestState,
  type Board,
  type BoardCard,
  type CardDependency,
  type State,
} from "@/lib/wails";
import { readMoment } from "@/lib/when";

/** PrimaryAction is the one primary of the panel, in each case of the card. */
export type PrimaryAction =
  | { kind: "start"; disabled: boolean } // Start task, S when enabled
  | { kind: "clone" } // Clone and continue, S
  | { kind: "cloning"; repository: string } // Cloning <repo>…, aria-busy
  | { kind: "retry-clone" } // Try the clone again, S
  | { kind: "add" }; // Start task, S, opens Add to board

/** PanelActions are the actions of the panel and the reason under them. */
export interface PanelActions {
  /** primary is the one primary of the view; null for has_task and closed. */
  primary: PrimaryAction | null;
  changePath: boolean;
  /** discuss is the secondary; D when enabled. */
  discuss: { disabled: boolean };
  /** reason is the line under the actions; error tone for the clone that failed. */
  reason: { text: string; tone: "neutral" | "error" } | null;
  /** discussReason is why Discuss is dashed, for its aria-describedby. */
  discussReason: string | null;
}

/** DependencyNoticeModel is a dependency not satisfied, as the panel warns of it. */
export interface DependencyNoticeModel {
  key: string;
  /** title is "Depends on #461". */
  title: string;
  issueTitle: string;
  meta: string;
}

/** BoardRelationItem is a relation of the card; a card of the reading opens in the panel. */
export type BoardRelationItem = RelationItem & { cardKey?: string };

/** BoardRelationGroup is a titled group of relations, only with items. */
export interface BoardRelationGroup {
  label: string;
  items: readonly BoardRelationItem[];
}

/** CardPanelModel is everything the panel of a card draws, in the order it draws it. */
export interface CardPanelModel {
  head: { number: string; repository: string };
  title: string;
  /** status is "No status" without one; epic is the title of the epic of the card. */
  status: { name: string; closed: boolean; epic: string | null };
  actions: PanelActions;
  dependencies: DependencyNoticeModel[];
  task:
    | { kind: "active"; taskId: string }
    | { kind: "archived"; taskId: string; name: string }
    | null;
  discussions: { id: string; title: string; archived: boolean }[];
  /** fields are those of the card in the order they came, Assignees last. */
  fields: { key: string; value: string }[];
  body: string;
  relations: BoardRelationGroup[];
}

/** CloneState is the clone of the repository of the card: running, or failed with the message of gh. */
export interface CloneState {
  cloning: boolean;
  error: string | null;
}

/** CardPanelContext is what the panel reads beyond its card. */
export interface CardPanelContext {
  app: State;
  board: Board;
  /** children is epicChildren(board.cards) computed once for the reading. */
  children: ReadonlyMap<string, EpicChild[]>;
  clone: CloneState;
  /** outOfReading is a card the last reading of the board no longer has. */
  outOfReading: boolean;
}

// panelActions is the table of the actions of a card: one row for each case.
function panelActions(card: BoardCard, ctx: CardPanelContext): PanelActions {
  const checkable = isCheckable(card, ctx.app, ctx.board.id);
  const notIn = `${card.repository} isn't a repository of this board.`;
  const build = (
    primary: PrimaryAction | null,
    discussDisabled: boolean,
    reason: PanelActions["reason"],
    changePath = false,
  ): PanelActions => ({
    primary,
    changePath,
    discuss: { disabled: discussDisabled },
    reason,
    discussReason: discussDisabled ? notIn : null,
  });
  const neutral = (text: string) => ({ text, tone: "neutral" as const });
  if (ctx.outOfReading) {
    return { ...build({ kind: "start", disabled: true }, true, null), discussReason: null };
  }
  switch (card.action) {
    case "clone": {
      if (ctx.clone.cloning) {
        return build(
          { kind: "cloning", repository: card.repository },
          !checkable,
          neutral("The dialog opens when the clone ends. You can leave the board meanwhile."),
        );
      }
      if (ctx.clone.error !== null && ctx.clone.error !== "") {
        return build({ kind: "retry-clone" }, !checkable, {
          text: ctx.clone.error,
          tone: "error",
        });
      }
      return build(
        { kind: "clone" },
        !checkable,
        neutral(`${card.repository} isn't cloned yet. A task needs a clone.`),
      );
    }
    case "clone_missing": {
      const path = findRepository(ctx.app, card.repositoryId)?.path ?? "";
      return build(
        { kind: "start", disabled: true },
        !checkable,
        neutral(`The clone at ${path} is missing.`),
        true,
      );
    }
    case "add_to_board":
      return build(
        { kind: "add" },
        true,
        neutral(`${card.repository} isn't managed by this board. Start task adds it first.`),
      );
    case "other_board":
      return build(
        { kind: "start", disabled: true },
        true,
        neutral(`${card.repository} belongs to the board ${card.otherBoard}.`),
      );
    case "has_task":
      return build(null, !checkable, null);
    case "closed":
      return build(null, !checkable, neutral("The issue is closed."));
    default:
      return build({ kind: "start", disabled: false }, !checkable, null);
  }
}

// pullRequestsText is what a dependency not satisfied says of its pull requests.
function pullRequestsText(dependency: CardDependency): string {
  const prs = dependency.pullRequests ?? [];
  const [only] = prs;
  if (only === undefined) {
    return "no pull request";
  }
  if (prs.length === 1) {
    const state = prStateLabel(asPullRequestState(only.state));
    return `pull request ${referenceOf(only, dependency.repository)} · ${state}`;
  }
  return `${prs.length} pull requests, none merged`;
}

function dependencyNotice(dependency: CardDependency, repository: string): DependencyNoticeModel {
  const meta = [
    dependency.repository,
    stateLabel(asIssueState(dependency.state)),
    ...(dependency.status === "" ? [] : [dependency.status]),
    pullRequestsText(dependency),
  ].join(" · ");
  return {
    key: dependency.key,
    title: `Depends on ${referenceOf(dependency, repository)}`,
    issueTitle: dependency.title,
    meta: `${meta}. A warning only: it never blocks.`,
  };
}

function taskOf(card: BoardCard, app: State): CardPanelModel["task"] {
  if (card.activeTaskId !== "" && (app.tasks ?? []).some((task) => task.id === card.activeTaskId)) {
    return { kind: "active", taskId: card.activeTaskId };
  }
  if (card.archivedTaskId === "") {
    return null;
  }
  const archived = (app.history ?? []).find((task) => task.id === card.archivedTaskId);
  return { kind: "archived", taskId: card.archivedTaskId, name: archived?.name ?? "" };
}

function discussionsOf(card: BoardCard, app: State): CardPanelModel["discussions"] {
  const active = inDiscussion(card, app).map(({ id, title }) => ({ id, title, archived: false }));
  const writer = card.writtenBy;
  return writer?.archived
    ? [...active, { id: writer.id, title: writer.title, archived: true }]
    : active;
}

function fieldsOf(card: BoardCard): CardPanelModel["fields"] {
  const fields = (card.fields ?? []).map((field) => ({ key: field.name, value: field.value }));
  const assignees = (card.assignees ?? []).map((assignee) => assignee.login);
  return assignees.length === 0
    ? fields
    : [...fields, { key: "Assignees", value: assignees.join(", ") }];
}

interface Issue {
  repository: string;
  number: number;
  title: string;
  url: string;
  status: string;
  state: string;
}

// issueMeta is what a card of an epic says on the right: its status on the board, else Open or Closed.
function issueMeta(status: string, state: string): string {
  return status !== "" ? status : stateLabel(asIssueState(state));
}

function boardRelations(card: BoardCard, ctx: CardPanelContext): BoardRelationGroup[] {
  const inReading = new Set((ctx.board.cards ?? []).map((candidate) => candidate.key));
  const withCard = (key: string): { cardKey?: string } =>
    inReading.has(key) ? { cardKey: key } : {};
  const epicKids = ctx.children.get(card.key);
  const epic = card.epic;
  const siblings = card.siblings ?? [];
  // known is every issue the reading names: its cards, and the siblings they list off the board.
  const known = new Map<string, Issue>();
  for (const candidate of ctx.board.cards ?? []) {
    known.set(candidate.key, candidate);
    for (const sibling of candidate.siblings ?? []) {
      if (!known.has(sibling.key)) {
        known.set(sibling.key, sibling);
      }
    }
  }
  const kids = (epicKids ?? []).flatMap((child) => {
    const issue = known.get(child.key);
    return issue === undefined
      ? []
      : [
          {
            key: child.key,
            number: referenceOf(issue, card.repository),
            title: issue.title,
            meta: issueMeta(issue.status, issue.state),
            url: issue.url,
            ...withCard(child.key),
          },
        ];
  });
  const groups: BoardRelationGroup[] = [
    {
      label: "Epic",
      items:
        epic === null
          ? []
          : [
              {
                key: epic.key,
                number: referenceOf(epic, card.repository),
                title: epic.title,
                meta: inReading.has(epic.key) ? epicProgress(ctx.children.get(epic.key) ?? []) : "",
                url: epic.url,
                ...withCard(epic.key),
              },
            ],
    },
    {
      label: `Cards of the epic · ${siblings.length}`,
      items: siblings.map((sibling) => ({
        key: sibling.key,
        number: referenceOf(sibling, card.repository),
        title: sibling.title,
        meta: issueMeta(sibling.status, sibling.state),
        url: sibling.url,
        ...withCard(sibling.key),
      })),
    },
    { label: `Cards · ${kids.length}`, items: kids },
    {
      label: "Dependencies",
      items: (card.dependencies ?? []).map((dependency) => {
        const merged = (dependency.pullRequests ?? []).find((pr) => pr.state === "merged");
        const open = asIssueState(dependency.state) === "open";
        const meta = [
          stateLabel(asIssueState(dependency.state)),
          ...(dependency.status === "" ? [] : [dependency.status]),
          ...(open && dependency.satisfied && merged !== undefined
            ? [`merged ${referenceOf(merged, dependency.repository)}`]
            : []),
        ].join(" · ");
        return {
          key: dependency.key,
          number: referenceOf(dependency, card.repository),
          title: dependency.title,
          meta,
          url: dependency.url,
          ...(dependency.satisfied ? {} : { warning: "Not satisfied" }),
          ...withCard(dependency.key),
        };
      }),
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
  return groups.filter((group) => group.items.length > 0);
}

/** cardPanelModel is the panel of a card: its head, actions, warnings, task, fields, body and relations. */
export function cardPanelModel(card: BoardCard, ctx: CardPanelContext): CardPanelModel {
  return {
    head: { number: `#${card.number}`, repository: card.repository },
    title: card.title,
    status: {
      name: card.status === "" ? "No status" : card.status,
      closed: card.state === "closed",
      epic: card.epic?.title ?? null,
    },
    actions: panelActions(card, ctx),
    dependencies: unsatisfied(card).map((dependency) =>
      dependencyNotice(dependency, card.repository),
    ),
    task: taskOf(card, ctx.app),
    discussions: discussionsOf(card, ctx.app),
    fields: fieldsOf(card),
    body: card.body,
    relations: boardRelations(card, ctx),
  };
}

/** outOfReadingText is what the strip of a card out of the reading explains, with when the reading was. */
export function outOfReadingText(board: Board, now: number): string {
  const when = readMoment(board.readAt, now);
  return `It left the board, or its issue closed more than 14 days ago. The reading of ${when} doesn't have it, so a task or a discussion can't start from it.`;
}
