import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  getAdjustedPanelWidth,
  PANEL_UNCOVERED,
  panelGeometry,
  setAdjustedPanelWidth,
  useAdjustedPanelWidth,
} from "./panel-width";

afterEach(() => setAdjustedPanelWidth(null));

describe("panelGeometry", () => {
  it("gives an item panel its default, beside the column from 1120px", () => {
    expect(panelGeometry("item", 1119, null)).toMatchObject({ width: 360, beside: false });
    expect(panelGeometry("item", 1120, null)).toMatchObject({ width: 360, beside: true });
    expect(panelGeometry("item", 1285, null).width).toBe(360);
    expect(panelGeometry("item", 2000, null).width).toBe(480);
  });

  it("gives a list panel its default, beside the list from 800px", () => {
    expect(panelGeometry("list", 800, null)).toMatchObject({ width: 360, beside: true });
    expect(panelGeometry("list", 799, null).beside).toBe(false);
    expect(panelGeometry("list", 2000, null).width).toBe(640);
  });

  it("never renders below the default", () => {
    expect(panelGeometry("item", 1600, 100).width).toBe(448);
  });

  it("never renders above the area less 64px", () => {
    expect(panelGeometry("item", 1600, 5000).width).toBe(1600 - PANEL_UNCOVERED);
  });

  it("covers the column once the width passes the room it keeps", () => {
    expect(panelGeometry("item", 1600, 900)).toMatchObject({ width: 900, beside: false });
  });

  it("keeps the widest at or above the default in a tiny area", () => {
    const geometry = panelGeometry("item", 200, 5000);
    expect(geometry.max).toBe(geometry.min);
    expect(geometry.width).toBe(geometry.min);
  });
});

describe("the adjusted width", () => {
  it("starts unset and tells its readers when it changes", () => {
    expect(getAdjustedPanelWidth()).toBeNull();
    const { result } = renderHook(() => useAdjustedPanelWidth());
    expect(result.current).toBeNull();

    act(() => setAdjustedPanelWidth(700));

    expect(result.current).toBe(700);
  });
});
