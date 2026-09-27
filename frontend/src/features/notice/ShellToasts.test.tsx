import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShellToasts } from "@/features/notice/ShellToasts";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeArchivedTask, makeRepository, makeState } from "@/test/wails-mock";

const TOAST = { id: "task-1", taskId: "task-1", name: "add-login" };

describe("ShellToasts", () => {
  it("says what the store announces", () => {
    renderWithStore(<ShellToasts />);

    act(() => useAppStore.getState().announce("Nothing else needs you now."));

    expect(screen.getByRole("status")).toHaveTextContent("Nothing else needs you now.");
  });

  it("says nothing before an announcement", () => {
    renderWithStore(<ShellToasts />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows the toast of a task that was archived", () => {
    renderWithStore(<ShellToasts />, { ui: { toasts: [TOAST] } });

    expect(screen.getByRole("status")).toHaveTextContent("“add-login” was archived");
  });

  it("opens the archived task from the toast, which leaves", async () => {
    const { user } = renderWithStore(<ShellToasts />, {
      state: makeState({
        repositories: [makeRepository()],
        history: [makeArchivedTask({ id: "task-1" })],
      }),
      ui: { toasts: [TOAST] },
    });

    await user.click(screen.getByRole("button", { name: "Open in History" }));

    expect(useAppStore.getState().location).toEqual({ kind: "archived-task", id: "task-1" });
    expect(useAppStore.getState().toasts).toEqual([]);
  });

  it("lets a toast a newer one pushes out go, keeping three", () => {
    const toasts = ["1", "2", "3"].map((n) => ({ id: `task-${n}`, taskId: `task-${n}`, name: n }));
    renderWithStore(<ShellToasts />, { ui: { toasts } });

    act(() =>
      useAppStore.setState({
        toasts: [...toasts.slice(1), { id: "task-4", taskId: "task-4", name: "4" }],
      }),
    );

    expect(screen.queryByText("“1” was archived")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Dismiss" })).toHaveLength(3);
  });

  it("takes the toast off on Dismiss", async () => {
    const { user } = renderWithStore(<ShellToasts />, { ui: { toasts: [TOAST] } });

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(useAppStore.getState().toasts).toEqual([]);
  });
});
