import { describe, expect, it } from "vitest";
import {
  cloneMissingText,
  defaultRepositoryId,
  filterLabel,
  findRepository,
  removeBlockedText,
  repositoryCounts,
  reviewCount,
  shortName,
  shortRef,
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

describe("shortRef", () => {
  it("writes an issue with the name part of its repository", () => {
    expect(shortRef("acme/billing#479")).toBe("billing#479");
  });

  it("keeps a reference without a number, or without an owner, as it is", () => {
    expect(shortRef("acme/billing")).toBe("acme/billing");
    expect(shortRef("billing#479")).toBe("billing#479");
    expect(shortRef("")).toBe("");
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

describe("reviewCount", () => {
  it("reads a count of reviews, with or without their kind", () => {
    expect(reviewCount(1)).toBe("1 review");
    expect(reviewCount(3)).toBe("3 reviews");
    expect(reviewCount(1, "active")).toBe("1 active review");
    expect(reviewCount(0, "archived")).toBe("0 archived reviews");
  });
});

describe("repositoryCounts", () => {
  it("reads the tasks alone when the repository has no review", () => {
    expect(repositoryCounts(makeRepository({ activeTasks: 2, archivedTasks: 5 }))).toBe(
      "2 active tasks · 5 archived tasks",
    );
  });

  it("adds the reviews, active and archived together", () => {
    const repository = makeRepository({ activeReviews: 1, archivedReviews: 2 });

    expect(repositoryCounts(repository)).toBe("0 active tasks · 0 archived tasks · 3 reviews");
  });
});

describe("removeBlockedText", () => {
  it("is null for a repository with no task and no review", () => {
    expect(removeBlockedText(web)).toBeNull();
  });

  it("says how many tasks stand in the way", () => {
    const busy = makeRepository({ activeTasks: 2, archivedTasks: 1 });

    expect(removeBlockedText(busy)).toBe(
      "dev/web has 2 active tasks and 1 archived task. Delete them before removing the repository.",
    );
  });

  it("says how many reviews stand in the way once no task does", () => {
    const reviewed = makeRepository({ activeReviews: 1, archivedReviews: 2 });

    expect(removeBlockedText(reviewed)).toBe(
      "dev/web has 1 active review and 2 archived reviews. Delete them before removing the repository.",
    );
  });

  it("names the tasks first when there are tasks and reviews", () => {
    const both = makeRepository({ activeTasks: 1, activeReviews: 1 });

    expect(removeBlockedText(both)).toBe(
      "dev/web has 1 active task and 0 archived tasks. Delete them before removing the repository.",
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

  it("skips a repository registered without a clone", () => {
    const uncloned = makeRepository({ cloned: false, path: "" });
    const app = makeState({ repositories: [uncloned, api], repositoryFilter: "repo-1" });

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
