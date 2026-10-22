import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommandRow } from "@/features/chat/entries/CommandRow";
import type { ActionEntry } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { api, makeAction, makeEntry } from "@/test/wails-mock";

const TESTS = {
  tool: "Bash",
  label: "Ran",
  description: "Run the rate limit tests",
  target: "go test ./internal/ratelimit/... -race",
  commandLines: 1,
  startedAt: "2026-09-05T10:00:00Z",
  finishedAt: "2026-09-05T10:00:08.2Z",
} satisfies Partial<ActionEntry>;

function row(overrides: Partial<ActionEntry> = {}, waiting = false) {
  const action = makeAction({ ...TESTS, ...overrides });
  return (
    <ul>
      <CommandRow
        taskId="task-1"
        stage="step:3"
        entry={makeEntry("action", { action })}
        action={action}
        waiting={waiting}
      />
    </ul>
  );
}

function renderRow(overrides: Partial<ActionEntry> = {}, waiting = false) {
  return renderWithStore(row(overrides, waiting));
}

const FAILED = {
  status: "error",
  exitCode: 1,
  outputLines: 1,
  outputTail: "--- FAIL: TestBurst",
} satisfies Partial<ActionEntry>;

const RUNNING = { status: "running", finishedAt: "" } satisfies Partial<ActionEntry>;

describe("CommandRow", () => {
  it("reads by the description, with the command after it and the duration", () => {
    renderRow();

    const row = screen.getByRole("listitem", {
      name: "Run the rate limit tests: go test ./internal/ratelimit/... -race, 8.2s",
    });
    expect(row).toHaveTextContent("Run the rate limit tests");
    expect(row).toHaveTextContent("8.2s");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("puts the command in the place of the label without a description", () => {
    renderRow({ description: "" });

    expect(
      screen.getByRole("listitem", { name: "go test ./internal/ratelimit/... -race, 8.2s" }),
    ).toBeInTheDocument();
  });

  it("folds its output by default when it passed", async () => {
    const { user } = renderRow({ outputLines: 2, outputTail: "ok\ndone" });

    const toggle = screen.getByRole("button", { name: /, output$/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/ok\s+done/)).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/ok\s+done/)).toBeInTheDocument();
  });

  it("opens the output of a command that fails on screen", () => {
    const { rerender } = renderRow(RUNNING);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(row(FAILED));

    expect(screen.getByRole("button", { name: /, output$/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("--- FAIL: TestBurst")).toBeInTheDocument();
  });

  it("leaves the output as the user left it when the command fails after", async () => {
    const { user, rerender } = renderRow({ status: "done", outputLines: 1, outputTail: "ok" });
    const toggle = screen.getByRole("button", { name: /, output$/ });
    await user.click(toggle);
    await user.click(toggle);

    rerender(row(FAILED));

    expect(screen.getByRole("button", { name: /, output$/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens the output of a failure, with the rail", () => {
    const { container } = renderRow({
      status: "error",
      exitCode: 1,
      outputLines: 1,
      outputTail: "--- FAIL: TestBurst",
    });

    expect(
      screen.getByRole("button", {
        name: "Run the rate limit tests: go test ./internal/ratelimit/... -race, exit 1, 8.2s, output",
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("--- FAIL: TestBurst")).toBeInTheDocument();
    expect(container.querySelector("[data-output]")?.className).toContain("--error-rail");
  });

  it("has no fold while it runs", () => {
    renderRow({ status: "running", finishedAt: "", outputLines: 3, outputTail: "a\nb\nc" });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("points to the card below while it waits for a permission", () => {
    renderRow({ status: "running", finishedAt: "" }, true);

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("the command in the card below");
    expect(row).toHaveTextContent("waits for your permission");
  });

  it.each(["Bash", "Monitor"])(
    "opens the live output of a %s running in the background",
    async (tool) => {
      api.getTaskOutput.mockResolvedValue({ text: "tick 1", lines: 1, truncated: false });
      const { user } = renderRow({ ...RUNNING, tool, background: true, taskId: "b1x2" });

      await user.click(screen.getByRole("button", { expanded: false }));

      expect(await screen.findByText("tick 1")).toBeInTheDocument();
      expect(api.getTaskOutput).toHaveBeenCalledWith("task-1", "step:3", "b1x2");
    },
  );

  it("has no output to open for a running command in the foreground", () => {
    renderRow({ ...RUNNING, background: false });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("has no output to open before the task of a background command starts", () => {
    renderRow({ ...RUNNING, background: true, taskId: "" });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("returns to the output the product recorded when the task ends", async () => {
    api.getTaskOutput.mockResolvedValue({ text: "tick 1", lines: 1, truncated: false });
    const running = { ...RUNNING, background: true, taskId: "b1x2" };
    const { user, rerender } = renderRow(running);
    await user.click(screen.getByRole("button", { expanded: false }));
    await screen.findByText("tick 1");

    rerender(
      row({
        ...running,
        status: "done",
        finishedAt: "2026-09-05T10:00:08.2Z",
        outputLines: 1,
        outputTail: "line 1",
      }),
    );

    expect(await screen.findByText("line 1")).toBeInTheDocument();
    expect(screen.queryByText("tick 1")).not.toBeInTheDocument();
  });
});
