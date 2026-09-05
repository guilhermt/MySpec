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

  it("renders the welcome placeholder without a workspace", async () => {
    vi.mocked(api.getState).mockResolvedValue(makeState({ workspace: null }));

    renderWithStore(<App />);

    expect(await screen.findByText("No workspace open")).toBeInTheDocument();
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
