import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StartSidebar } from "@/features/startup/StartSidebar";
import { renderWithStore } from "@/test/render";

describe("StartSidebar", () => {
  it("is the Work sidebar in skeleton, with only the mark and the theme", () => {
    renderWithStore(<StartSidebar still={false} />);

    const sidebar = screen.getByRole("complementary", { name: "Work" });
    expect(sidebar).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("group", { name: "Loading your work" })).toBeInTheDocument();
    expect(screen.getByText("MySpec")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Collapse/ })).not.toBeInTheDocument();
  });

  it("is the strip when it is collapsed, with the theme at its foot", () => {
    renderWithStore(<StartSidebar still={false} />, { ui: { sidebarRail: true } });

    expect(screen.getByRole("group", { name: "Loading your work" })).toBeInTheDocument();
    expect(screen.queryByText("MySpec")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
  });

  it.each([false, true])(
    "stands still without a status when the start failed (rail %s)",
    (rail) => {
      renderWithStore(<StartSidebar still />, { ui: { sidebarRail: rail } });

      expect(screen.getByRole("complementary", { name: "Work" })).toHaveAttribute(
        "aria-busy",
        "false",
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(document.querySelector(".shimmer-fill, [class*=shimmer]")).toBeNull();
    },
  );
});
