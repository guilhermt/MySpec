import { describe, expect, it } from "vitest";
import { caseHint, casesByKind, caseTitle } from "@/features/migration/migration-text";
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
