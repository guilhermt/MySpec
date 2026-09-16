import { describe, expect, it } from "vitest";
import {
  cloneMissingText,
  defaultRepositoryId,
  filterLabel,
  findRepository,
  removeBlockedText,
  shortName,
  takenNames,
  taskCount,
  tasksInFilter,
} from "@/lib/repositories";
import { makeArchivedTask, makeRepository, makeState, makeTask } from "@/test/wails-mock";

const web = makeRepository();
const api = makeRepository({
  id: "repo-2",
  name: "api",
  fullName: "dev/api",
  path: "/home/dev/projects/api",
});

describe("shortName", () => {
  it("is the name part of owner/name", () => {
    expect(shortName("dev/web")).toBe("web");
    expect(shortName("dev/some-long-name")).toBe("some-long-name");
  });

  it("is the whole thing when there is no owner", () => {
    expect(shortName("web")).toBe("web");
    expect(shortName("")).toBe("");
  });
});

describe("findRepository", () => {
  const app = makeState({ repositories: [web, api] });

  it("finds a repository by its id", () => {
    expect(findRepository(app, "repo-2")?.fullName).toBe("dev/api");
  });

  it("is null for an id that is not registered, and without a state", () => {
    expect(findRepository(app, "repo-9")).toBeNull();
    expect(findRepository(null, "repo-1")).toBeNull();
  });
});

describe("cloneMissingText", () => {
  it("names the path the clone is not at", () => {
    expect(cloneMissingText(web)).toBe("The clone at /home/dev/projects/web is missing.");
  });
});

describe("taskCount", () => {
  it("reads a count with the kind of task", () => {
    expect(taskCount(1, "active")).toBe("1 active task");
    expect(taskCount(3, "archived")).toBe("3 archived tasks");
    expect(taskCount(0, "active")).toBe("0 active tasks");
  });
});

describe("removeBlockedText", () => {
  it("is null for a repository with no task", () => {
    expect(removeBlockedText(web)).toBeNull();
  });

  it("says how many tasks stand in the way", () => {
    const busy = makeRepository({ activeTasks: 2, archivedTasks: 1 });

    expect(removeBlockedText(busy)).toBe(
      "dev/web has 2 active tasks and 1 archived task. Delete them before removing the repository.",
    );
  });
});

describe("filterLabel", () => {
  const app = makeState({ repositories: [web, api] });

  it("names the repository of the filter", () => {
    expect(filterLabel(app, "repo-2")).toBe("dev/api");
  });

  it("names every repository when the filter is empty or unknown", () => {
    expect(filterLabel(app, "")).toBe("All repositories");
    expect(filterLabel(app, "repo-9")).toBe("All repositories");
  });
});

describe("tasksInFilter", () => {
  const tasks = [
    makeTask({ id: "task-1", repositoryId: "repo-1" }),
    makeTask({ id: "task-2", repositoryId: "repo-2" }),
  ];

  it("keeps the tasks of the repository of the filter", () => {
    expect(tasksInFilter(tasks, "repo-2").map((task) => task.id)).toEqual(["task-2"]);
  });

  it("keeps them all with an empty filter", () => {
    expect(tasksInFilter(tasks, "")).toBe(tasks);
  });
});

describe("defaultRepositoryId", () => {
  const openTask = makeTask({ id: "task-1", repositoryId: "repo-2" });

  it("is the repository of the filter first", () => {
    const app = makeState({ repositories: [web, api], repositoryFilter: "repo-1" });

    expect(defaultRepositoryId(app, "task-1", "repo-2")).toBe("repo-1");
  });

  it("is the repository of the open task next", () => {
    const app = makeState({ repositories: [web, api], tasks: [openTask] });

    expect(defaultRepositoryId(app, "task-1", null)).toBe("repo-2");
  });

  it("is the repository of the last task created next", () => {
    const app = makeState({ repositories: [web, api] });

    expect(defaultRepositoryId(app, null, "repo-2")).toBe("repo-2");
  });

  it("is the first repository when nothing else says", () => {
    const app = makeState({ repositories: [web, api] });

    expect(defaultRepositoryId(app, null, null)).toBe("repo-1");
  });

  it("skips a repository whose clone is missing", () => {
    const gone = makeRepository({ missing: true });
    const app = makeState({ repositories: [gone, api], repositoryFilter: "repo-1" });

    expect(defaultRepositoryId(app, null, "repo-2")).toBe("repo-2");
  });

  it("is empty with no repository the dialog can use", () => {
    const app = makeState({ repositories: [makeRepository({ missing: true })] });

    expect(defaultRepositoryId(app, null, null)).toBe("");
  });
});

describe("takenNames", () => {
  it("are the active and the archived tasks of the repository", () => {
    const app = makeState({
      repositories: [web, api],
      tasks: [
        makeTask({ id: "task-1", name: "add-login", repositoryId: "repo-1" }),
        makeTask({ id: "task-2", name: "wire-the-api", repositoryId: "repo-2" }),
      ],
      history: [
        makeArchivedTask({ id: "task-3", name: "old-login", repositoryId: "repo-1" }),
        makeArchivedTask({ id: "task-4", name: "old-api", repositoryId: "repo-2" }),
      ],
    });

    expect(takenNames(app, "repo-1")).toEqual(["add-login", "old-login"]);
  });
});
