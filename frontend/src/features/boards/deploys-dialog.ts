import type {
  DeployBranchOption,
  DeployEnvironmentSettings,
  DeployRepositoryOptions,
  DeploySettings,
  DeployWorkflow,
  SaveDeploySettingsRequest,
} from "@/lib/wails";

/** MIN_ENVIRONMENTS is how many environments a repository needs: one to receive the code and one to promote it to. */
export const MIN_ENVIRONMENTS = 2;

/** OptionsState is what GitHub offers the configuration of one repository, as the dialog holds it. */
export type OptionsState =
  | { status: "reading" }
  | { status: "ready"; workflows: DeployWorkflow[]; branches: DeployBranchOption[] }
  | { status: "failed"; message: string };

/** RepositoryState is one repository of the board in the dialog. */
export interface RepositoryState {
  repositoryId: string;
  fullName: string;
  managed: boolean;
  environments: DeployEnvironmentSettings[];
  options: OptionsState;
}

/** DialogState is what the user chose in the dialog so far. */
export interface DialogState {
  boardId: string;
  enabled: boolean;
  /** repositories are the ones of the board, alphabetical. */
  repositories: RepositoryState[];
}

/** initialState is the dialog as the settings say it, with nothing read from GitHub yet. */
export function initialState(settings: DeploySettings): DialogState {
  return {
    boardId: settings.boardId,
    enabled: settings.enabled,
    repositories: (settings.repositories ?? [])
      .map((repository) => ({
        repositoryId: repository.repositoryId,
        fullName: repository.fullName,
        managed: repository.managed,
        environments: [...(repository.environments ?? [])],
        options: { status: "reading" as const },
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  };
}

function withRepository(
  state: DialogState,
  repositoryId: string,
  change: (repository: RepositoryState) => RepositoryState,
): DialogState {
  return {
    ...state,
    repositories: state.repositories.map((repository) =>
      repository.repositoryId === repositoryId ? change(repository) : repository,
    ),
  };
}

/** withChecked makes a repository managed or not; its environments are kept for the dialog's life. */
export function withChecked(
  state: DialogState,
  repositoryId: string,
  checked: boolean,
): DialogState {
  return withRepository(state, repositoryId, (repository) => ({
    ...repository,
    managed: checked,
  }));
}

/** withEnvironment changes the fields of one environment. */
export function withEnvironment(
  state: DialogState,
  repositoryId: string,
  index: number,
  patch: Partial<DeployEnvironmentSettings>,
): DialogState {
  return withRepository(state, repositoryId, (repository) => ({
    ...repository,
    environments: repository.environments.map((environment, at) =>
      at === index ? { ...environment, ...patch } : environment,
    ),
  }));
}

/** withMoved moves an environment up (-1) or down (1); at an end it stays. */
export function withMoved(
  state: DialogState,
  repositoryId: string,
  index: number,
  delta: -1 | 1,
): DialogState {
  return withRepository(state, repositoryId, (repository) => {
    const moved = repository.environments[index];
    const other = repository.environments[index + delta];
    if (moved === undefined || other === undefined) {
      return repository;
    }
    const environments = [...repository.environments];
    environments[index] = other;
    environments[index + delta] = moved;
    return { ...repository, environments };
  });
}

/** withRemoved takes an environment out, unless the repository would be left with too few. */
export function withRemoved(state: DialogState, repositoryId: string, index: number): DialogState {
  return withRepository(state, repositoryId, (repository) =>
    repository.environments.length <= MIN_ENVIRONMENTS
      ? repository
      : { ...repository, environments: repository.environments.filter((_, at) => at !== index) },
  );
}

/** withAdded appends an empty environment. */
export function withAdded(state: DialogState, repositoryId: string): DialogState {
  return withRepository(state, repositoryId, (repository) => ({
    ...repository,
    environments: [
      ...repository.environments,
      { name: "", branch: "", workflowId: 0, workflowName: "", workflowPath: "" },
    ],
  }));
}

/** withReading marks the options of a repository as being read: the first reading and Try again. */
export function withReading(state: DialogState, repositoryId: string): DialogState {
  return withRepository(state, repositoryId, (repository) => ({
    ...repository,
    options: { status: "reading" },
  }));
}

/**
 * withOptions keeps what GitHub offered a repository and gives the suggested workflow to each
 * environment that has none; a failed reading leaves the environments as they are.
 */
export function withOptions(
  state: DialogState,
  repositoryId: string,
  options: DeployRepositoryOptions,
): DialogState {
  return withRepository(state, repositoryId, (repository) => {
    if (options.failure !== "") {
      return { ...repository, options: { status: "failed", message: options.failure } };
    }
    const workflows = options.workflows ?? [];
    const branches = options.branches ?? [];
    const environments = repository.environments.map((environment) => {
      if (environment.workflowId !== 0) {
        return environment;
      }
      const suggested = branches.find((branch) => branch.branch === environment.branch)?.suggested;
      const workflow = workflows.find((each) => each.id === suggested);
      return workflow === undefined
        ? environment
        : {
            ...environment,
            workflowId: workflow.id,
            workflowName: workflow.name,
            workflowPath: workflow.path,
          };
    });
    return { ...repository, environments, options: { status: "ready", workflows, branches } };
  });
}

/** branchesOf are the branches of a repository as typed, which GitHub is asked about. */
export function branchesOf(repository: RepositoryState): string[] {
  return repository.environments
    .map((environment) => environment.branch.trim())
    .filter((branch) => branch !== "");
}

/** missingBranch says whether GitHub was asked about the branch and has none by that name. */
export function missingBranch(repository: RepositoryState, branch: string): boolean {
  if (repository.options.status !== "ready") {
    return false;
  }
  const wanted = branch.trim();
  return repository.options.branches.some((each) => each.branch === wanted && !each.exists);
}

function hasDuplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/** BLOCKS are the reasons Save waits, in the order they are told: the first that holds is shown. */
const BLOCKS: readonly {
  holds: (environments: readonly DeployEnvironmentSettings[]) => boolean;
  text: (name: string) => string;
}[] = [
  {
    holds: (envs) => envs.some((each) => each.name.trim() === ""),
    text: (name) => `Name every environment of ${name}.`,
  },
  {
    holds: (envs) => envs.some((each) => each.branch.trim() === ""),
    text: (name) => `Choose a branch for every environment of ${name}.`,
  },
  {
    holds: (envs) => envs.some((each) => each.workflowId === 0),
    text: (name) => `Choose the workflow of every environment of ${name}.`,
  },
  {
    holds: (envs) => hasDuplicate(envs.map((each) => each.branch.trim())),
    text: (name) => `Two environments of ${name} share a branch.`,
  },
  {
    // The names are told apart without regard to case, as the Go side does.
    holds: (envs) => hasDuplicate(envs.map((each) => each.name.trim().toLowerCase())),
    text: (name) => `Two environments of ${name} share a name.`,
  },
];

/** saveBlock is why Save waits, or "" when the configuration can be saved. */
export function saveBlock(state: DialogState): string {
  const managed = state.repositories.filter((repository) => repository.managed);
  for (const { holds, text } of BLOCKS) {
    const repository = managed.find((each) => holds(each.environments));
    if (repository !== undefined) {
      return text(repository.fullName);
    }
  }
  return "";
}

/** requestOf is what Save sends: the managed repositories only, with names and branches trimmed. */
export function requestOf(state: DialogState): SaveDeploySettingsRequest {
  return {
    boardId: state.boardId,
    enabled: state.enabled,
    repositories: state.repositories
      .filter((repository) => repository.managed)
      .map((repository) => ({
        repositoryId: repository.repositoryId,
        environments: repository.environments.map((environment) => ({
          ...environment,
          name: environment.name.trim(),
          branch: environment.branch.trim(),
        })),
      })),
  };
}
