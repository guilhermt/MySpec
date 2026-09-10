import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArchivedNotice } from "@/features/notice/ArchivedNotice";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";

const NOTICE = { id: "task-1", name: "add-login" };

afterEach(() => {
  vi.useRealTimers();
});

describe("ArchivedNotice", () => {
  it("names the task that left the workspace", () => {
    renderWithStore(<ArchivedNotice />, { ui: { archivedNotice: NOTICE } });

    expect(screen.getByRole("status")).toHaveTextContent("“add-login” was archived.");
  });

  it("opens the archived task in the history", async () => {
    const { user } = renderWithStore(<ArchivedNotice />, { ui: { archivedNotice: NOTICE } });

    await user.click(screen.getByRole("button", { name: "Open in history" }));

    expect(useAppStore.getState().openArchivedId).toBe("task-1");
    expect(useAppStore.getState().historyOpen).toBe(true);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismisses on demand", async () => {
    const { user } = renderWithStore(<ArchivedNotice />, { ui: { archivedNotice: NOTICE } });

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(useAppStore.getState().archivedNotice).toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("sees itself out after a while", () => {
    vi.useFakeTimers();
    renderWithStore(<ArchivedNotice />, { ui: { archivedNotice: NOTICE } });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(useAppStore.getState().archivedNotice).toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says nothing when nothing was archived", () => {
    const { container } = renderWithStore(<ArchivedNotice />);

    expect(container).toBeEmptyDOMElement();
  });
});
