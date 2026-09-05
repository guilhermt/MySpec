import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ROOT_NODE_ID,
  repoNodeId,
  useAppStore,
  useError,
  useNotice,
  useRecents,
  useThemeState,
  useTreeUi,
  useWorkspace,
} from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

const API_NODE = repoNodeId("/home/dev/projects/api");
const WEB_NODE = repoNodeId("/home/dev/projects/web");

beforeEach(() => {
  resetAppStore();
});

describe("applyState", () => {
  it("keeps the tree selection while the workspace path is the same", () => {
    useAppStore.getState().applyState(makeState());
    useAppStore.getState().selectNode(WEB_NODE);
    useAppStore.getState().setNodeExpanded(WEB_NODE, true);

    useAppStore.getState().applyState(makeState({ systemDark: true }));

    expect(useAppStore.getState().selectedNodeId).toBe(WEB_NODE);
    expect(useAppStore.getState().expandedNodeIds.has(WEB_NODE)).toBe(true);
  });

  it("resets the tree selection when the workspace path changes", () => {
    useAppStore.getState().applyState(makeState());
    useAppStore.getState().selectNode(WEB_NODE);
    useAppStore.getState().toggleNode(WEB_NODE);

    useAppStore.getState().applyState(
      makeState({
        workspace: { name: "labs", path: "/home/dev/labs", repos: [] },
      }),
    );

    expect(useAppStore.getState().selectedNodeId).toBe(ROOT_NODE_ID);
    expect([...useAppStore.getState().expandedNodeIds]).toEqual([ROOT_NODE_ID]);
  });

  it("falls back to root when the selected repository is gone", () => {
    useAppStore.getState().applyState(makeState());
    useAppStore.getState().selectNode(WEB_NODE);

    useAppStore.getState().applyState(
      makeState({
        workspace: {
          name: "projects",
          path: "/home/dev/projects",
          repos: [{ name: "api", path: "/home/dev/projects/api" }],
        },
      }),
    );

    expect(useAppStore.getState().selectedNodeId).toBe(ROOT_NODE_ID);
  });

  it("keeps a repository selected when it survives the rescan", () => {
    useAppStore.getState().applyState(makeState());
    useAppStore.getState().selectNode(API_NODE);

    useAppStore.getState().applyState(makeState());

    expect(useAppStore.getState().selectedNodeId).toBe(API_NODE);
  });

  it("treats a workspace without repositories as having no repository nodes", () => {
    useAppStore.getState().applyState(makeState());
    useAppStore.getState().selectNode(API_NODE);

    useAppStore.getState().applyState(
      makeState({
        workspace: { name: "projects", path: "/home/dev/projects", repos: null },
      }),
    );

    expect(useAppStore.getState().selectedNodeId).toBe(ROOT_NODE_ID);
  });
});

describe("tree ui", () => {
  it("toggles a node on and off", () => {
    useAppStore.getState().toggleNode(API_NODE);
    expect(useAppStore.getState().expandedNodeIds.has(API_NODE)).toBe(true);

    useAppStore.getState().toggleNode(API_NODE);
    expect(useAppStore.getState().expandedNodeIds.has(API_NODE)).toBe(false);
  });

  it("collapses a node through setNodeExpanded", () => {
    useAppStore.getState().setNodeExpanded(ROOT_NODE_ID, false);
    expect(useAppStore.getState().expandedNodeIds.has(ROOT_NODE_ID)).toBe(false);
  });
});

describe("selectors", () => {
  it("report an empty state before the first snapshot", () => {
    const { result } = renderHook(() => ({
      workspace: useWorkspace(),
      recents: useRecents(),
      notice: useNotice(),
      error: useError(),
      theme: useThemeState(),
      tree: useTreeUi(),
    }));

    expect(result.current.workspace).toBeNull();
    expect(result.current.recents).toEqual([]);
    expect(result.current.notice).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.theme).toEqual({ preference: "system", systemDark: false });
    expect(result.current.tree.selectedNodeId).toBe(ROOT_NODE_ID);
  });

  it("report the current snapshot", () => {
    const { result } = renderHook(() => ({
      workspace: useWorkspace(),
      recents: useRecents(),
      notice: useNotice(),
      error: useError(),
      theme: useThemeState(),
      tree: useTreeUi(),
    }));

    act(() => {
      useAppStore.getState().applyState(
        makeState({
          theme: "dark",
          systemDark: true,
          notice: { path: "/home/dev/gone", reason: "not_found" },
        }),
      );
      useAppStore.getState().setError("binding failed");
    });

    expect(result.current.workspace?.name).toBe("projects");
    expect(result.current.recents).toHaveLength(3);
    expect(result.current.notice?.reason).toBe("not_found");
    expect(result.current.error).toBe("binding failed");
    expect(result.current.theme).toEqual({ preference: "dark", systemDark: true });
    expect([...result.current.tree.expandedNodeIds]).toEqual([ROOT_NODE_ID]);
  });

  it("falls back to an empty recent list when the snapshot has none", () => {
    const { result } = renderHook(() => useRecents());

    act(() => {
      useAppStore.getState().applyState(makeState({ recents: null }));
    });

    expect(result.current).toEqual([]);
  });
});
