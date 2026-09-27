import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeState, makeTask } from "@/test/wails-mock";

function sidebar() {
  return renderWithStore(<Sidebar />, { state: makeState({ tasks: [makeTask()] }) });
}

describe("Sidebar", () => {
  it("puts the filter, the tasks and the footer together", () => {
    sidebar();

    expect(
      screen.getByRole("button", { name: "Repository filter: All repositories" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /^task add-login\./ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^History/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
  });

  it("puts the node of the reviews above the tasks", () => {
    sidebar();

    const reviews = screen.getByRole("navigation", { name: "Reviews" });
    const tasks = screen.getByRole("tree", { name: "Active items" });
    expect(reviews.compareDocumentPosition(tasks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("opens the creation dialog from New task", async () => {
    const { user } = sidebar();

    await user.click(screen.getByRole("button", { name: "New task" }));

    expect(useAppStore.getState().newTaskOpen).toBe(true);
  });
});
