import { describe, expect, it } from "vitest";
import {
  caseHint,
  casesByKind,
  caseTitle,
  caseWhere,
  copyText,
  taskWhere,
} from "@/features/migration/migration-text";
import { makeMigration } from "@/test/wails-mock";

describe("caseTitle and caseHint", () => {
  it("names every kind and says what to do about it", () => {
    expect(caseTitle("root_task")).toBe("Tasks at the root of a workspace");
    expect(caseTitle("no_origin")).toBe("Repositories without an origin on GitHub");
    expect(caseTitle("name_conflict")).toBe("Tasks with the same name in the same repository");

    expect(caseHint("root_task")).toBe(
      "Close or delete these tasks in the previous version of MySpec.",
    );
    expect(caseHint("no_origin")).toBe(
      "Add a GitHub origin to the repository, or delete its tasks, in the previous version of MySpec.",
    );
    expect(caseHint("name_conflict")).toBe(
      "Delete one of the tasks in the previous version of MySpec.",
    );
  });
});

describe("casesByKind", () => {
  it("groups the cases in the order the screen lists them, leaving the empty kinds out", () => {
    const migration = makeMigration({
      cases: [
        { kind: "name_conflict", repository: "dev/web", detail: "", tasks: [] },
        { kind: "root_task", repository: "", detail: "", tasks: [] },
        { kind: "name_conflict", repository: "dev/api", detail: "", tasks: [] },
      ],
    });

    expect(casesByKind(migration)).toEqual([
      { kind: "root_task", cases: [migration.cases?.[1]] },
      { kind: "name_conflict", cases: [migration.cases?.[0], migration.cases?.[2]] },
    ]);
  });

  it("takes a kind it doesn't know for a task at the root", () => {
    const migration = makeMigration({
      cases: [{ kind: "something_else", repository: "", detail: "", tasks: [] }],
    });

    expect(casesByKind(migration).map((group) => group.kind)).toEqual(["root_task"]);
  });

  it("has no group without a case", () => {
    expect(casesByKind({ cases: [] })).toEqual([]);
  });
});

const FULL = makeMigration({
  cases: [
    {
      kind: "name_conflict",
      repository: "acme/api",
      detail: "",
      tasks: [
        { name: "rate-limit", workspace: "/home/dev/work/api", path: "/home/dev/work/api" },
        { name: "rate-limit", workspace: "/home/dev/code", path: "" },
      ],
    },
    {
      kind: "root_task",
      repository: "",
      detail: "",
      tasks: [{ name: "billing-export", workspace: "/home/dev/work", path: "" }],
    },
    {
      kind: "no_origin",
      repository: "/home/dev/work/legacy-portal",
      detail:
        "The origin remote of /home/dev/work/legacy-portal is not on GitHub: git@gitlab.com:acme/legacy-portal.git.",
      tasks: [
        { name: "portal-sso", workspace: "/home/dev/work", path: "/home/dev/work/legacy-portal" },
      ],
    },
  ],
});

describe("caseWhere and taskWhere", () => {
  it("writes a path with a tilde and leaves owner/name alone", () => {
    const [name, , origin] = FULL.cases ?? [];
    expect(name && caseWhere(name)).toBe("acme/api");
    expect(origin && caseWhere(origin)).toBe("~/work/legacy-portal");
  });

  it("takes the workspace of a task at the root as its place", () => {
    const root = FULL.cases?.[1];
    expect(root && caseWhere(root)).toBe("~/work");
  });

  it("says the workspace of a task, and its path when it has one", () => {
    expect(taskWhere({ name: "a", workspace: "/home/dev/work", path: "" })).toBe("~/work");
    expect(taskWhere({ name: "a", workspace: "/home/dev/work", path: "/home/dev/work/api" })).toBe(
      "~/work · ~/work/api",
    );
  });
});

describe("copyText", () => {
  it("lists the kinds in order, each with its place, detail and tasks", () => {
    expect(copyText(FULL)).toBe(
      [
        "MySpec couldn't be updated",
        "",
        "Tasks at the root of a workspace",
        "Close or delete these tasks in the previous version of MySpec.",
        "- ~/work",
        "  - billing-export · ~/work",
        "",
        "Repositories without an origin on GitHub",
        "Add a GitHub origin to the repository, or delete its tasks, in the previous version of MySpec.",
        "- ~/work/legacy-portal",
        "  The origin remote of ~/work/legacy-portal is not on GitHub: git@gitlab.com:acme/legacy-portal.git.",
        "  - portal-sso · ~/work · ~/work/legacy-portal",
        "",
        "Tasks with the same name in the same repository",
        "Delete one of the tasks in the previous version of MySpec.",
        "- acme/api",
        "  - rate-limit · ~/work/api · ~/work/api",
        "  - rate-limit · ~/code",
      ].join("\n"),
    );
  });

  it("is only the title without a case", () => {
    expect(copyText({ cases: [] })).toBe("MySpec couldn't be updated");
  });
});
