import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtifactPanel } from "@/features/task/ArtifactPanel";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeTask } from "@/test/wails-mock";

describe("ArtifactPanel", () => {
  it("says there is nothing to read before the PRD exists", () => {
    renderWithStore(<ArtifactPanel task={makeTask()} />);

    expect(screen.getByText("No artifacts yet")).toBeInTheDocument();
    expect(api.readArtifact).not.toHaveBeenCalled();
  });

  it("renders the PRD once it is written", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Login");
    renderWithStore(<ArtifactPanel task={makeTask({ hasPrd: true, artifactVersion: 1 })} />);

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Login");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "PRD.md");
  });

  it("reads the file again when the agent rewrites it", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("first");
    const task = makeTask({ hasPrd: true, artifactVersion: 1 });
    const { rerender } = renderWithStore(<ArtifactPanel task={task} />);
    expect(await screen.findByTestId("markdown")).toHaveTextContent("first");

    vi.mocked(api.readArtifact).mockResolvedValue("second");
    rerender(<ArtifactPanel task={{ ...task, artifactVersion: 2 }} />);

    expect(await screen.findByTestId("markdown")).toHaveTextContent("second");
    expect(api.readArtifact).toHaveBeenCalledTimes(2);
  });

  it("shows a failed read and lets it be dismissed", async () => {
    vi.mocked(api.readArtifact).mockRejectedValue(new Error("read failed"));
    const { user } = renderWithStore(
      <ArtifactPanel task={makeTask({ hasPrd: true, artifactVersion: 1 })} />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent("read failed");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
