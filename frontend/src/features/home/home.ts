import { discussionRow, type ItemRow, reviewRow, taskRow } from "@/features/sidebar/sidebar-tree";
import { breadcrumbOf, isActiveItem, type Location, locationExists } from "@/lib/locations";
import { cloneMissingText, findRepository, shortName } from "@/lib/repositories";
import { compareSituations } from "@/lib/situations";
import type { Board, Place, Repository, ReviewCenter, State } from "@/lib/wails";
import { age } from "@/lib/when";

/** ContinueModel is the item Continue offers to go back to. */
export interface ContinueModel {
  /** location is the task, review or discussion. */
  location: Location;
  /** row is the row of the tree of the item: taskRow, reviewRow or discussionRow. */
  row: ItemRow;
  /** crumbs is where the item lives: "Platform Roadmap / API hardening", "No board", "Reviews". */
  crumbs: string;
  /** label is "Continue: <row.label> <crumbs>", the label of the row already ends in a period. */
  label: string;
  /** situation is where Enter opens the item: the most serious situation, null without one. */
  situation: { itemId: string; place: Place } | null;
}

// rowOf is the row of the tree of an active item, null when the item is gone.
function rowOf(app: State, location: Location, now: number): ItemRow | null {
  switch (location.kind) {
    case "task": {
      const task = (app.tasks ?? []).find((candidate) => candidate.id === location.id);
      return task === undefined ? null : taskRow(app, task, now);
    }
    case "review": {
      const review = (app.reviews ?? []).find((candidate) => candidate.id === location.id);
      return review === undefined ? null : reviewRow(review, now);
    }
    case "discussion": {
      const discussion = (app.discussions ?? []).find((candidate) => candidate.id === location.id);
      return discussion === undefined ? null : discussionRow(discussion, now);
    }
    default:
      return null;
  }
}

// newestItem is the active item created last, null without any.
function newestItem(app: State): Location | null {
  const items: { location: Location; createdAt: number }[] = [
    ...(app.tasks ?? []).map((task) => ({
      location: { kind: "task", id: task.id } as const,
      createdAt: Date.parse(task.createdAt) || 0,
    })),
    ...(app.reviews ?? []).map((review) => ({
      location: { kind: "review", id: review.id } as const,
      createdAt: Date.parse(review.createdAt) || 0,
    })),
    ...(app.discussions ?? []).map((discussion) => ({
      location: { kind: "discussion", id: discussion.id } as const,
      createdAt: Date.parse(discussion.createdAt) || 0,
    })),
  ];
  return (
    items.reduce<(typeof items)[number] | null>(
      (newest, item) => (newest === null || item.createdAt > newest.createdAt ? item : newest),
      null,
    )?.location ?? null
  );
}

/**
 * continueItem is the item Continue offers: the first active item that still
 * exists among the place on screen and the places behind it, from the most
 * recent; else the last item opened; else the active item created last; null
 * when there is none.
 */
export function continueItem(
  app: State,
  location: Location,
  back: readonly Location[],
  lastItem: Location | null,
  now: number,
): ContinueModel | null {
  const found =
    [location, ...[...back].reverse()].find(
      (place) => isActiveItem(place) && locationExists(app, place),
    ) ??
    (lastItem !== null && isActiveItem(lastItem) && locationExists(app, lastItem)
      ? lastItem
      : newestItem(app));
  const row = found === null ? null : rowOf(app, found, now);
  if (found === null || row === null) {
    return null;
  }
  const crumbs = breadcrumbOf(app, found)
    .map((crumb) => crumb.label)
    .join(" / ");
  const [main] = [...(row.item.situations ?? [])].sort(compareSituations);
  return {
    location: found,
    row,
    crumbs,
    label: crumbs === "" ? `Continue: ${row.label}` : `Continue: ${row.label} ${crumbs}`,
    situation: main === undefined ? null : { itemId: row.id, place: main.place },
  };
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** reviewSubtitle is what the Review a pull request row says of the pending reviews. */
export function reviewSubtitle(center: ReviewCenter): { text: string; shimmer: boolean } {
  if (center.readAt === "") {
    return center.reading
      ? { text: "reading…", shimmer: true }
      : { text: "Not read yet", shimmer: false };
  }
  if (center.pendingCount === 0) {
    return { text: "Nothing pending", shimmer: false };
  }
  const repositories = new Set(
    (center.pullRequests ?? [])
      .filter((row) => row.pending && !row.filtered)
      .map((row) => row.repositoryId),
  );
  return {
    text: `${center.pendingCount} pending in ${repositories.size} ${plural(repositories.size, "repository", "repositories")}`,
    shimmer: false,
  };
}

/** BlockerModel is a line under a board: what keeps its cards from starting a task, with its way out. */
export type BlockerModel =
  | { kind: "read-failed"; message: string; reading: boolean }
  | {
      kind: "not-cloned";
      repositoryId: string;
      /** text is the sentence, or the message of gh for a clone that failed, or Cloning… while it runs. */
      text: string;
      /** blocked puts the blocked glyph before the sentence: the repository is not cloned and nothing is cloning it. */
      blocked?: boolean;
      cloning: boolean;
      error: string;
    }
  | { kind: "clone-missing"; repositoryId: string; text: string; blocked: boolean };

/** BoardLineModel is a board of the Boards section. */
export interface BoardLineModel {
  boardId: string;
  title: string;
  /** summary is "46 open cards · api, billing", "Not read yet · api" or "No open cards · api". */
  summary: string;
  /** reading is what the right edge says: "read 2m ago", "Read failed 18m ago" (blocked) or "reading…"; failure is the failed one's times, for its tooltip. */
  reading: {
    text: string;
    /** blocked puts the blocked glyph before the text. */
    blocked?: boolean;
    tone: "quiet" | "failed";
    shimmer: boolean;
    failure?: { failedAt: string; readAt: string };
  };
  /** label is "Platform Roadmap, 46 open cards, read 2m ago". */
  label: string;
  blockers: BlockerModel[];
}

// openCards is how many cards of the reading are still to choose: open, and not in a final status.
function openCards(board: Board): number {
  const final = new Set((board.statuses ?? []).filter((status) => status.final).map((s) => s.id));
  return (board.cards ?? []).filter(
    (card) => card.state !== "closed" && !(board.hasStatus && final.has(card.statusId)),
  ).length;
}

function repositoriesOf(app: State, ids: readonly string[]): Repository[] {
  return ids.flatMap((id) => findRepository(app, id) ?? []);
}

// cloneBlockers are the lines of the repositories that cannot start a task, one per repository, by name.
function cloneBlockers(repositories: readonly Repository[]): BlockerModel[] {
  return [...repositories]
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .flatMap((repository): BlockerModel[] => {
      if (!repository.cloned) {
        const failed = !repository.cloning && repository.cloneError !== "";
        return [
          {
            kind: "not-cloned",
            repositoryId: repository.id,
            text: repository.cloning
              ? `Cloning ${repository.fullName}…`
              : failed
                ? repository.cloneError
                : `${repository.fullName} isn't cloned. Its cards can't start a task yet.`,
            ...(!repository.cloning && !failed ? { blocked: true } : {}),
            cloning: repository.cloning,
            error: repository.cloneError,
          },
        ];
      }
      if (repository.missing) {
        return [
          {
            kind: "clone-missing",
            repositoryId: repository.id,
            text: cloneMissingText(repository),
            blocked: true,
          },
        ];
      }
      return [];
    });
}

// namesOf are the short names of repositories, alphabetically.
function namesOf(repositories: readonly Repository[]): string {
  return repositories
    .map((repository) => shortName(repository.fullName))
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
}

// readingOf is what the right edge of a board says of its reading.
function readingOf(board: Board, now: number): BoardLineModel["reading"] {
  const shimmer = board.reading;
  if (board.readAt === "" && board.reading) {
    return { text: "reading…", tone: "quiet", shimmer };
  }
  if (board.failure !== null) {
    return {
      text: `Read failed ${age(board.failure.failedAt, now)}`,
      blocked: true,
      tone: "failed",
      shimmer,
      failure: { failedAt: board.failure.failedAt, readAt: board.readAt },
    };
  }
  if (board.readAt !== "") {
    return { text: `read ${age(board.readAt, now)}`, tone: "quiet", shimmer };
  }
  return { text: "Not read yet", tone: "quiet", shimmer: false };
}

/** boardLines are the boards of the Boards section, in the order of the state. */
export function boardLines(app: State, now: number): BoardLineModel[] {
  return (app.boards ?? []).map((board) => {
    const repositories = repositoriesOf(app, board.repositoryIds ?? []);
    const count = openCards(board);
    const cards =
      board.readAt === ""
        ? "Not read yet"
        : count === 0
          ? "No open cards"
          : `${count} open ${plural(count, "card", "cards")}`;
    const names = namesOf(repositories);
    const reading = readingOf(board, now);
    return {
      boardId: board.id,
      title: board.title,
      summary: names === "" ? cards : `${cards} · ${names}`,
      reading,
      label: `${board.title}, ${cards}, ${reading.text}`,
      blockers: [
        ...(board.failure === null
          ? []
          : [
              {
                kind: "read-failed",
                message: board.failure.message,
                reading: board.reading,
              } as const,
            ]),
        ...cloneBlockers(repositories),
      ],
    };
  });
}

/** noBoardLine is the line of the repositories no board manages, null when every one has a board. */
export function noBoardLine(app: State): { names: string; blockers: BlockerModel[] } | null {
  const repositories = (app.repositories ?? []).filter((repository) => repository.boardId === "");
  return repositories.length === 0
    ? null
    : { names: namesOf(repositories), blockers: cloneBlockers(repositories) };
}
