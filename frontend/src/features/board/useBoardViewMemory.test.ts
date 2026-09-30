import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/features/board/board-view";
import { useBoardViewMemory } from "@/features/board/useBoardViewMemory";
import { boardViewKey } from "@/lib/ui-storage";
import { resetAppStore } from "@/test/render";
import { makeBoard, makeRepository, makeState } from "@/test/wails-mock";

function open() {
  resetAppStore({
    state: makeState({
      repositories: [makeRepository({ boardId: "board-1" })],
      boards: [makeBoard()],
    }),
  });
}

function stored(): unknown {
  return JSON.parse(localStorage.getItem(boardViewKey("board-1")) ?? "null");
}

afterEach(() => {
  localStorage.clear();
});

describe("useBoardViewMemory", () => {
  it("remembers the filters and the sections between mounts", () => {
    open();
    const first = renderHook(() => useBoardViewMemory("board-1"));
    act(() => {
      first.result.current[1]((current) => ({
        filters: { ...current.filters, query: "login" },
        collapsed: ["todo"],
      }));
    });
    first.unmount();

    const second = renderHook(() => useBoardViewMemory("board-1"));

    expect(second.result.current[0].filters.query).toBe("login");
    expect(second.result.current[0].collapsed).toEqual(["todo"]);
  });

  it("names the filters from the reading before it keeps them", () => {
    open();
    const { result } = renderHook(() => useBoardViewMemory("board-1"));

    act(() => {
      result.current[1]((current) => ({
        ...current,
        filters: { ...current.filters, repository: "repo-1", status: "todo" },
      }));
    });

    expect(result.current[0].filters).toMatchObject({
      repository: "repo-1",
      repositoryName: "dev/web",
      status: "todo",
      statusName: "Todo",
    });
    expect(stored()).toMatchObject({
      filters: { repositoryName: "dev/web", statusName: "Todo" },
    });
  });

  it("reads the form kept without names, and gives it the names of the reading", () => {
    open();
    const { query: _query, repositoryName: _r, statusName: _s, ...withoutNames } = EMPTY_FILTERS;
    localStorage.setItem(
      boardViewKey("board-1"),
      JSON.stringify({
        filters: { ...withoutNames, query: "", repository: "repo-1", status: "in-progress" },
      }),
    );

    const { result } = renderHook(() => useBoardViewMemory("board-1"));

    expect(result.current[0].filters).toMatchObject({
      repositoryName: "dev/web",
      statusName: "In progress",
    });
    expect(stored()).toMatchObject({
      filters: { repositoryName: "dev/web", statusName: "In progress" },
    });
  });

  it("keeps the raw id of a repository the reading does not have, for an orphan chip", () => {
    open();
    localStorage.setItem(
      boardViewKey("board-1"),
      JSON.stringify({
        filters: {
          query: "",
          repository: "repo-9",
          status: "",
          assignee: "",
          mine: false,
        },
      }),
    );

    const { result } = renderHook(() => useBoardViewMemory("board-1"));

    expect(result.current[0].filters).toMatchObject({
      repository: "repo-9",
      repositoryName: "",
    });
  });

  it("falls back to no filters for a value it cannot read", () => {
    open();
    localStorage.setItem(boardViewKey("board-1"), '{"filters":"nope"}');

    const { result } = renderHook(() => useBoardViewMemory("board-1"));

    expect(result.current[0].filters).toEqual(EMPTY_FILTERS);
  });

  it("collapses the final statuses until the user chooses", () => {
    open();
    const { result } = renderHook(() => useBoardViewMemory("board-1"));

    expect(result.current[0].collapsed).toEqual(["done"]);
    expect(stored()).toEqual({ filters: EMPTY_FILTERS });

    act(() => {
      result.current[1]((current) => ({ ...current, collapsed: [] }));
    });

    expect(result.current[0].collapsed).toEqual([]);
    expect(stored()).toEqual({ filters: EMPTY_FILTERS, collapsed: [] });
  });
});
