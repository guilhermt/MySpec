import { describe, expect, it } from "vitest";
import { emptyTasksText, taskRows } from "@/features/sidebar/task-list";
import {
  makeRepository,
  makeSituation,
  makeState,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

const WEB_TASK = makeTask();
const API_TASK = makeTask({
  id: "task-2",
  name: "fix-header",
  repositoryId: "repo-2",
  repository: "dev/api",
});

describe("taskRows", () => {
  it("names each task with its repository, long and short", () => {
    const [first, second] = taskRows([WEB_TASK, API_TASK], null, new Set());

    expect(first).toMatchObject({ fullName: "dev/web", shortName: "web", selected: false });
    expect(second).toMatchObject({ fullName: "dev/api", shortName: "api" });
  });

  it("carries the number of the card of a task, null without one", () => {
    const carded = makeTask({ card: makeTaskCard({ number: 42 }) });

    expect(taskRows([carded, API_TASK], null, new Set()).map((row) => row.cardNumber)).toEqual([
      42,
      null,
    ]);
  });

  it("marks the open task as selected", () => {
    const rows = taskRows([WEB_TASK, API_TASK], "task-2", new Set());

    expect(rows.map((row) => row.selected)).toEqual([false, true]);
  });

  it("flashes a task whose situation just started while it is not open", () => {
    const waiting = { ...WEB_TASK, situations: [makeSituation({ id: "s1" })] };
    const flashing = new Set(["s1"]);

    expect(taskRows([waiting], null, flashing)[0]?.flashing).toBe(true);
    expect(taskRows([waiting], waiting.id, flashing)[0]?.flashing).toBe(false);
    expect(taskRows([waiting], null, new Set())[0]?.flashing).toBe(false);
  });
});

describe("emptyTasksText", () => {
  const app = makeState({ repositories: [makeRepository()] });

  it("names the repository of the filter", () => {
    expect(emptyTasksText(app, "repo-1")).toBe("No tasks in web.");
  });

  it("says nothing of a repository without a filter", () => {
    expect(emptyTasksText(app, "")).toBe("No tasks yet.");
  });
});
