import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Home } from "@/features/home/Home";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeState, makeTask } from "@/test/wails-mock";

describe("Home", () => {
  it("invites the first task when there is none", () => {
    renderWithStore(<Home />, { state: makeState() });

    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create the first task in one of your repositories."),
    ).toBeInTheDocument();
  });

  it("points at the list once there are tasks", () => {
    renderWithStore(<Home />, { state: makeState({ tasks: [makeTask()] }) });

    expect(screen.getByText("No task open")).toBeInTheDocument();
    expect(screen.getByText("Pick a task from the list, or create a new one.")).toBeInTheDocument();
  });

  it("opens the creation dialog", async () => {
    const { user } = renderWithStore(<Home />, { state: makeState() });

    await user.click(screen.getByRole("button", { name: /^New task/ }));

    expect(useAppStore.getState().newTaskOpen).toBe(true);
  });

  it("keeps pointing at the list once there are tasks, boards or not", () => {
    renderWithStore(<Home />, {
      state: makeState({ boards: [makeBoard()], tasks: [makeTask()] }),
    });

    expect(screen.getByText("No task open")).toBeInTheDocument();
  });
});
