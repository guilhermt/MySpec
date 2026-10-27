// biome-ignore-all lint/a11y/useSemanticElements: the matrix is a CSS grid of divs with the roles of an ARIA grid; a table would give up the subgrid and the narrow layout
// biome-ignore-all lint/a11y/useFocusableInteractive: the rows and the headers of a grid are not focusable; its cells are, by a roving tabindex
// biome-ignore-all lint/a11y/noStaticElementInteractions: the wrapper only follows the focus of its cells
import { Fragment } from "react";
import { Button } from "@/components/system/Button";
import { Spinner } from "@/components/system/Spinner";
import { SunkenLine } from "@/components/system/SunkenLine";
import { DeployCell } from "@/features/deploys/DeployCell";
import { DeployPassage } from "@/features/deploys/DeployPassage";
import {
  boardColumns,
  type ColumnHeader,
  cellModel,
  environmentsOf,
  neverRead,
  passageModel,
} from "@/features/deploys/deploy-matrix";
import type { DeployGridKeyboard } from "@/features/deploys/useDeployGridKeyboard";
import type { DeployBoard, DeployRepository } from "@/lib/wails";
import { age } from "@/lib/when";
import { refreshDeployRepository } from "@/store/actions";

/** OpenSlot is the environment whose panel is open, and the slot that opened it. */
export interface OpenSlot {
  repositoryId: string;
  position: number;
  from: "cell" | "passage";
}

export interface DeployMatrixProps {
  boards: readonly DeployBoard[];
  now: number;
  keyboard: DeployGridKeyboard;
  open: OpenSlot | null;
  /** flashing are the environments, by repository and position, that a new reading changed. */
  flashing: ReadonlySet<string>;
  onActivate: (slot: OpenSlot) => void;
}

/** ROW is a row of the grid, on the columns of the grid. Below the narrow limit of the board section (48rem) the name takes a row of its own and the passages shrink. */
const ROW = "col-span-full grid grid-cols-subgrid items-stretch gap-y-(--space-1)";

function wideColumns(count: number): string {
  const pairs = Math.max(count - 1, 0);
  return `var(--deploy-repo-column) repeat(${pairs}, minmax(var(--deploy-cell-min), 1fr) minmax(var(--deploy-passage-min), auto)) minmax(var(--deploy-cell-min), 1fr)`;
}

function narrowColumns(count: number): string {
  const pairs = Math.max(count - 1, 0);
  return `repeat(${pairs}, minmax(0, 1fr) var(--deploy-passage-narrow)) minmax(0, 1fr)`;
}

interface RowProps {
  repo: DeployRepository;
  headers: readonly ColumnHeader[];
  names: readonly (string | null)[];
  showOwner: boolean;
  now: number;
  keyboard: DeployGridKeyboard;
  open: OpenSlot | null;
  flashing: ReadonlySet<string>;
  onActivate: (slot: OpenSlot) => void;
}

function RepositoryRow({
  repo,
  headers,
  names,
  showOwner,
  now,
  keyboard,
  open,
  flashing,
  onActivate,
}: RowProps) {
  const environments = neverRead(repo) ? [] : environmentsOf(repo);
  const failed = repo.failure !== null;
  return (
    <>
      <div role="row" className={ROW}>
        <div
          role="rowheader"
          className="flex min-w-0 items-center gap-(--space-2) @max-[48rem]/deploys:col-span-full"
        >
          <span className="min-w-0 truncate text-(length:--text-ui) leading-(--leading-ui) font-medium text-ink-2">
            {repo.name}
          </span>
          {showOwner && (
            <span className="min-w-0 truncate text-(length:--text-meta) leading-(--leading-meta) text-ink-4">
              {repo.owner}
            </span>
          )}
        </div>
        {headers.map(({ position }) => {
          const env = environments[position];
          if (env === undefined) {
            return (
              <Fragment key={position}>
                {position > 0 && <div aria-hidden="true" />}
                <div role="gridcell" aria-hidden="true" />
              </Fragment>
            );
          }
          const cell = cellModel(repo, env, now);
          const passage = passageModel(repo, env);
          const isOpen = open?.repositoryId === repo.id && open.position === position;
          const slot = { repositoryId: repo.id, position };
          return (
            <Fragment key={position}>
              {passage !== null && (
                <DeployPassage
                  model={passage}
                  tabIndex={keyboard.tabIndexOf(passage.key)}
                  open={isOpen && open?.from === "passage"}
                  onActivate={() => onActivate({ ...slot, from: "passage" })}
                />
              )}
              <DeployCell
                model={cell}
                environment={names[position] === null ? env.name : null}
                tabIndex={keyboard.tabIndexOf(cell.key)}
                open={isOpen && open?.from === "cell"}
                flash={flashing.has(`${repo.id}:${position}`)}
                onActivate={() => onActivate({ ...slot, from: "cell" })}
              />
            </Fragment>
          );
        })}
      </div>
      {failed && <FailedRead repo={repo} now={now} />}
    </>
  );
}

/** FailedRead is the reading of one repository failing, under its row: the cells above are the reading before. */
function FailedRead({ repo, now }: { repo: DeployRepository; now: number }) {
  const since = age(repo.failure?.failedAt ?? "", now);
  return (
    <div role="row" className="col-span-full">
      <div role="gridcell">
        <SunkenLine
          icon="blocked"
          action={
            repo.reading ? (
              <span className="inline-flex items-center gap-(--space-1-5) px-(--space-2) text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
                <Spinner />
                Reading…
              </span>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void refreshDeployRepository(repo.id, repo.name)}
              >
                Try again
              </Button>
            )
          }
        >
          {`Couldn't read ${repo.name}${since === "" ? "" : ` · ${since}`}`}
          {repo.failure !== null && repo.failure.message !== "" && (
            <span className="text-ink-3"> {repo.failure.message}</span>
          )}
        </SunkenLine>
      </div>
    </div>
  );
}

/** DeployMatrix is one grid per board: a row per repository, a column per environment, and between two environments the passage that promotes. */
export function DeployMatrix({
  boards,
  now,
  keyboard,
  open,
  flashing,
  onActivate,
}: DeployMatrixProps) {
  return (
    <div onFocus={keyboard.onFocus} className="flex flex-col gap-(--section-gap) pb-(--space-6)">
      {boards.map((board) => {
        const headers = boardColumns(board);
        const repositories = board.repositories ?? [];
        const owners = new Set(repositories.map((repo) => repo.owner));
        const names = headers.map((header) => header.name);
        const columns = headers.length;
        return (
          <section
            key={board.id}
            aria-label={board.title}
            className="@container/deploys flex flex-col gap-(--space-2)"
          >
            <h2 className="inline-flex items-baseline gap-(--space-2) px-(--space-2) text-(length:--text-meta) leading-(--leading-meta) font-semibold text-ink-2">
              {board.title}
              <span className="text-(length:--text-micro) leading-(--leading-micro) font-normal tabular-nums text-ink-4">
                {repositories.length === 1 ? "1 repository" : `${repositories.length} repositories`}
              </span>
            </h2>
            <div
              role="grid"
              aria-label={`${board.title} deploys`}
              style={
                {
                  "--deploy-grid": wideColumns(columns),
                  "--deploy-grid-narrow": narrowColumns(columns),
                } as React.CSSProperties
              }
              className="grid grid-cols-(--deploy-grid) gap-x-(--space-2) gap-y-(--space-3) @max-[48rem]/deploys:grid-cols-(--deploy-grid-narrow)"
            >
              <div
                role="row"
                className={`${ROW} text-(length:--text-meta) leading-(--leading-meta) text-ink-3`}
              >
                <div role="columnheader" className="@max-[48rem]/deploys:hidden" />
                {headers.map((header) => (
                  <Fragment key={header.position}>
                    {header.position > 0 && <div role="columnheader" aria-hidden="true" />}
                    <div role="columnheader" className="px-(--space-2)">
                      {header.name}
                    </div>
                  </Fragment>
                ))}
              </div>
              {repositories.map((repo) => (
                <RepositoryRow
                  key={repo.id}
                  repo={repo}
                  headers={headers}
                  names={names}
                  showOwner={owners.size > 1}
                  now={now}
                  keyboard={keyboard}
                  open={open}
                  flashing={flashing}
                  onActivate={onActivate}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
