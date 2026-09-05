import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";
import { api } from "@/lib/wails";
import { renderWithStore, resetAppStore } from "@/test/render";
import { makeState, subscriberCount } from "@/test/wails-mock";

beforeEach(() => {
  resetAppStore();
});

describe("App", () => {
  it("renders the open workspace once the first snapshot arrives", async () => {
    renderWithStore(<App />);

    expect(await screen.findByRole("heading", { name: "MySpec" })).toBeInTheDocument();
    expect(screen.getByText("~/projects")).toBeInTheDocument();
  });

  it("renders the welcome screen without a workspace", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ workspace: null }));

    renderWithStore(<App />);

    expect(await screen.findByRole("button", { name: /^Open folder/ })).toBeInTheDocument();
  });

  it("opens the folder dialog on Ctrl+O", async () => {
    const { user } = renderWithStore(<App />);
    await screen.findByRole("heading", { name: "MySpec" });

    await user.keyboard("{Control>}o{/Control}");

    expect(api.openFolderDialog).toHaveBeenCalledOnce();
  });

  it("shows a rejected binding and dismisses it", async () => {
    vi.mocked(api.openFolderDialog).mockRejectedValueOnce(new Error("dialog failed"));
    const { user } = renderWithStore(<App />);
    await screen.findByRole("heading", { name: "MySpec" });

    await user.keyboard("{Control>}o{/Control}");

    expect(await screen.findByRole("status")).toHaveTextContent("dialog failed");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("unsubscribes when it unmounts", async () => {
    const { unmount } = renderWithStore(<App />);
    await screen.findByRole("heading", { name: "MySpec" });

    unmount();

    await waitFor(() => {
      expect(subscriberCount()).toBe(0);
    });
  });
});
