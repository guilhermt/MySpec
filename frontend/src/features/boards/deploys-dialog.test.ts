import { describe, expect, it } from "vitest";
import {
  branchesOf,
  type DialogState,
  initialState,
  missingBranch,
  requestOf,
  saveBlock,
  withAdded,
  withChecked,
  withEnvironment,
  withMoved,
  withOptions,
  withReading,
  withRemoved,
} from "@/features/boards/deploys-dialog";
import type { DeployEnvironmentSettings } from "@/lib/wails";
import { makeDeployRepositoryOptions, makeDeploySettings } from "@/test/wails-mock";

function environment(name: string, branch: string, workflowId = 0): DeployEnvironmentSettings {
  return {
    name,
    branch,
    workflowId,
    workflowName: workflowId === 0 ? "" : `Workflow ${workflowId}`,
    workflowPath: workflowId === 0 ? "" : `.github/workflows/${workflowId}.yml`,
  };
}

const ENVIRONMENTS = [
  environment("Development", "dev"),
  environment("Staging", "staging"),
  environment("Production", "main"),
];

function stateOf(managed = true): DialogState {
  return initialState(
    makeDeploySettings({
      enabled: true,
      repositories: [
        { repositoryId: "r-web", fullName: "dev/web", managed: false, environments: ENVIRONMENTS },
        { repositoryId: "r-api", fullName: "dev/api", managed, environments: ENVIRONMENTS },
      ],
    }),
  );
}

function apiOf(state: DialogState) {
  const repository = state.repositories.find((each) => each.repositoryId === "r-api");
  if (repository === undefined) {
    throw new Error("no api");
  }
  return repository;
}

describe("initialState", () => {
  it("lists the repositories alphabetically, reading, with the environments the settings give", () => {
    const state = stateOf();

    expect(state.repositories.map((each) => each.fullName)).toEqual(["dev/api", "dev/web"]);
    expect(state.enabled).toBe(true);
    expect(apiOf(state).environments).toEqual(ENVIRONMENTS);
    expect(apiOf(state).options).toEqual({ status: "reading" });
  });
});

describe("withChecked", () => {
  it("keeps the edited environments of a repository that is unchecked", () => {
    let state = withEnvironment(stateOf(), "r-api", 0, { name: "Dev" });
    state = withChecked(state, "r-api", false);
    state = withChecked(state, "r-api", true);

    expect(apiOf(state).managed).toBe(true);
    expect(apiOf(state).environments[0]?.name).toBe("Dev");
    expect(apiOf(withChecked(stateOf(), "r-api", false)).managed).toBe(false);
  });
});

describe("withMoved", () => {
  it("swaps an environment with its neighbour", () => {
    const up = apiOf(withMoved(stateOf(), "r-api", 1, -1)).environments.map((each) => each.name);
    const down = apiOf(withMoved(stateOf(), "r-api", 1, 1)).environments.map((each) => each.name);

    expect(up).toEqual(["Staging", "Development", "Production"]);
    expect(down).toEqual(["Development", "Production", "Staging"]);
  });

  it("stays at the ends", () => {
    expect(apiOf(withMoved(stateOf(), "r-api", 0, -1)).environments).toEqual(ENVIRONMENTS);
    expect(apiOf(withMoved(stateOf(), "r-api", 2, 1)).environments).toEqual(ENVIRONMENTS);
  });
});

describe("withRemoved and withAdded", () => {
  it("removes an environment, but never below two", () => {
    const three = withRemoved(stateOf(), "r-api", 1);
    expect(apiOf(three).environments.map((each) => each.name)).toEqual([
      "Development",
      "Production",
    ]);

    expect(apiOf(withRemoved(three, "r-api", 0)).environments).toHaveLength(2);
  });

  it("adds an empty environment last", () => {
    const state = withAdded(stateOf(), "r-api");

    expect(apiOf(state).environments).toHaveLength(4);
    expect(apiOf(state).environments[3]).toEqual(environment("", ""));
  });
});

describe("withOptions", () => {
  const options = makeDeployRepositoryOptions({
    workflows: [
      { id: 7, name: "Deploy staging", path: ".github/workflows/staging.yml" },
      { id: 9, name: "Release", path: ".github/workflows/release.yml" },
    ],
    branches: [
      { branch: "dev", exists: true, suggested: 0 },
      { branch: "staging", exists: true, suggested: 7 },
      { branch: "main", exists: false, suggested: 9 },
    ],
  });

  it("suggests the workflow only to the environments that have none", () => {
    const chosen = withEnvironment(stateOf(), "r-api", 2, {
      workflowId: 3,
      workflowName: "Mine",
      workflowPath: ".github/workflows/mine.yml",
    });
    const repository = apiOf(withOptions(chosen, "r-api", options));

    expect(repository.environments[0]?.workflowId).toBe(0);
    expect(repository.environments[1]).toEqual({
      name: "Staging",
      branch: "staging",
      workflowId: 7,
      workflowName: "Deploy staging",
      workflowPath: ".github/workflows/staging.yml",
    });
    expect(repository.environments[2]?.workflowId).toBe(3);
    expect(repository.options.status).toBe("ready");
  });

  it("keeps the environments when GitHub couldn't be read", () => {
    const repository = apiOf(
      withOptions(stateOf(), "r-api", makeDeployRepositoryOptions({ failure: "rate limited" })),
    );

    expect(repository.environments).toEqual(ENVIRONMENTS);
    expect(repository.options).toEqual({ status: "failed", message: "rate limited" });
  });

  it("goes back to reading", () => {
    const read = withOptions(stateOf(), "r-api", options);

    expect(apiOf(withReading(read, "r-api")).options).toEqual({ status: "reading" });
  });
});

describe("branchesOf and missingBranch", () => {
  it("lists the branches typed, trimmed, without the empty ones", () => {
    const state = withEnvironment(stateOf(), "r-api", 0, { branch: " dev " });
    const added = withAdded(state, "r-api");

    expect(branchesOf(apiOf(added))).toEqual(["dev", "staging", "main"]);
  });

  it("says a branch is missing only once GitHub said so", () => {
    const options = makeDeployRepositoryOptions({
      branches: [
        { branch: "staging", exists: false, suggested: 0 },
        { branch: "main", exists: true, suggested: 0 },
      ],
    });

    expect(missingBranch(apiOf(stateOf()), "staging")).toBe(false);
    const read = apiOf(withOptions(stateOf(), "r-api", options));
    expect(missingBranch(read, "staging")).toBe(true);
    expect(missingBranch(read, " staging ")).toBe(true);
    expect(missingBranch(read, "main")).toBe(false);
    expect(missingBranch(read, "other")).toBe(false);
  });
});

describe("saveBlock", () => {
  const complete = ENVIRONMENTS.map((each, index) => ({ ...each, workflowId: index + 1 }));

  function withAll(environments: DeployEnvironmentSettings[]): DialogState {
    return environments.reduce(
      (state, each, index) => withEnvironment(state, "r-api", index, each),
      stateOf(),
    );
  }

  it("lets a complete configuration through", () => {
    expect(saveBlock(withAll(complete))).toBe("");
  });

  it("lets an unmanaged repository go however it is", () => {
    expect(saveBlock(stateOf(false))).toBe("");
  });

  it.each([
    ["a name is empty", { name: " " }, "Name every environment of dev/api."],
    ["a branch is empty", { branch: "" }, "Choose a branch for every environment of dev/api."],
    [
      "a workflow is missing",
      { workflowId: 0 },
      "Choose the workflow of every environment of dev/api.",
    ],
    ["a branch is shared", { branch: " main" }, "Two environments of dev/api share a branch."],
    ["a name is shared", { name: "production" }, "Two environments of dev/api share a name."],
  ])("says why when %s", (_name, patch, want) => {
    const environments = complete.map((each, index) =>
      index === 0 ? { ...each, ...patch } : each,
    );

    expect(saveBlock(withAll(environments))).toBe(want);
  });

  it("tells the first reason that holds", () => {
    const environments = complete.map((each, index) =>
      index === 0 ? { ...each, name: "", branch: "main", workflowId: 0 } : each,
    );

    expect(saveBlock(withAll(environments))).toBe("Name every environment of dev/api.");
  });
});

describe("requestOf", () => {
  it("sends the managed repositories only, with the names and branches trimmed", () => {
    const state = withEnvironment(stateOf(), "r-api", 0, { name: " Dev ", branch: " dev " });

    const request = requestOf(state);

    expect(request.boardId).toBe("board-1");
    expect(request.enabled).toBe(true);
    expect(request.repositories).toHaveLength(1);
    expect(request.repositories?.[0]?.repositoryId).toBe("r-api");
    expect(request.repositories?.[0]?.environments?.[0]).toEqual(environment("Dev", "dev"));
  });
});
