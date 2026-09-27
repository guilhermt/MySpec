import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarTop } from "@/features/sidebar/SidebarTop";
import { SIDEBAR_RAIL_KEY } from "@/lib/ui-storage";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

describe("SidebarTop", () => {
  it("shows the name of the product and New", () => {
    renderWithStore(<SidebarTop />, { state: makeState() });

    expect(screen.getByText("MySpec")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("collapses the sidebar into its strip and keeps it so", async () => {
    const { user } = renderWithStore(<SidebarTop />, { state: makeState() });

    await user.click(screen.getByRole("button", { name: "Collapse the sidebar" }));

    expect(useAppStore.getState().sidebarRail).toBe(true);
    expect(localStorage.getItem(SIDEBAR_RAIL_KEY)).toBe("true");
  });
});
