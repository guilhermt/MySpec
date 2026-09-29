import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommandOutput } from "@/features/chat/entries/CommandOutput";
import { renderWithStore } from "@/test/render";
import { api } from "@/test/wails-mock";

const TAIL = Array.from({ length: 12 }, (_, i) => `line ${i + 25}`).join("\n");
const WHOLE = Array.from({ length: 36 }, (_, i) => `line ${i + 1}`).join("\n");

function renderOutput(overrides: { lines?: number; tail?: string; truncated?: boolean } = {}) {
  return renderWithStore(
    <CommandOutput
      taskId="task-1"
      stage="step:3"
      entryId="entry-9"
      lines={overrides.lines ?? 36}
      tail={overrides.tail ?? TAIL}
      truncated={overrides.truncated ?? false}
    />,
  );
}

describe("CommandOutput", () => {
  it("shows a short output whole, with nothing above it", () => {
    renderOutput({ lines: 2, tail: "ok\ndone" });

    expect(screen.getByText(/ok\s+done/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the tail of a long output and counts the lines above it", () => {
    renderOutput();

    expect(screen.getByText(/line 25/)).toBeInTheDocument();
    expect(screen.getByText("24 more lines above")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all 36 lines" })).toBeInTheDocument();
  });

  it("reads the whole output with a glow, and folds it back without reading again", async () => {
    let resolve: (value: { text: string; lines: number; truncated: boolean }) => void = () => {};
    api.getActionOutput.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { user } = renderOutput();

    await user.click(screen.getByRole("button", { name: "Show all 36 lines" }));
    expect(screen.getByText("Reading the output…")).toBeInTheDocument();
    expect(api.getActionOutput).toHaveBeenCalledWith("task-1", "step:3", "entry-9");

    resolve({ text: WHOLE, lines: 36, truncated: false });
    await screen.findByRole("button", { name: "Show less" });
    expect(document.querySelector("pre")?.textContent).toBe(WHOLE);
    await user.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getByText("24 more lines above")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show all 36 lines" }));
    expect(await screen.findByRole("button", { name: "Show less" })).toBeInTheDocument();
    expect(api.getActionOutput).toHaveBeenCalledTimes(1);
  });

  it("says a reading failed in place and tries again", async () => {
    api.getActionOutput.mockRejectedValueOnce(new Error("gone"));
    const { user } = renderOutput();

    await user.click(screen.getByRole("button", { name: "Show all 36 lines" }));
    expect(await screen.findByText("Couldn't read the output")).toBeInTheDocument();

    api.getActionOutput.mockResolvedValueOnce({ text: WHOLE, lines: 36, truncated: false });
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  it("says when the product kept only the end of the output", () => {
    renderOutput({ lines: 900, truncated: true });

    expect(screen.getByText("Only the last 64 KiB was kept")).toBeInTheDocument();
  });
});
