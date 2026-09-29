import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetailsPanel } from "@/features/task/DetailsPanel";
import { mainArea, resolve, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { fixSceneClock, sceneTask, TASK_ID } from "@/test/task-scenes";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

fixSceneClock();

describe.each(THEMES)("DetailsPanel in the %s theme", (theme) => {
  it("sets the keys of the facts in the --col-keys column, whole", () => {
    setTheme(theme);
    const { state } = sceneTask("run");
    const task = state.tasks?.[0];
    if (task === undefined) throw new Error("the scene has no task");
    renderWithStore(
      <div style={{ ...mainArea(1566), height: "800px", display: "flex" }}>
        <DetailsPanel task={task} />
      </div>,
      { state, ui: { location: { kind: "task", id: TASK_ID }, panel: "details" } },
    );

    const panel = screen.getByRole("complementary");
    const keys = [...panel.querySelectorAll("dl > dt")];
    const names = keys.map((key) => key.textContent);
    expect(names).toEqual(expect.arrayContaining(["Repository", "Review mode", "Worktree"]));

    const column = parseFloat(resolve("var(--col-keys)", "width"));
    expect(column).toBe(120);
    for (const key of keys) {
      const box = key.getBoundingClientRect();
      expect(box.width, `${key.textContent} width`).toBe(column);
      expect(Number.isInteger(box.width), `${key.textContent} on a whole pixel`).toBe(true);
      expect(key.scrollWidth, `${key.textContent} cut`).toBeLessThanOrEqual(key.clientWidth);
    }
  });
});
