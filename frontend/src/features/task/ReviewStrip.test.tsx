import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ReviewStrip } from "@/features/task/ReviewStrip";
import { api, type Review, type Step } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReview, makeState, makeStep, makeTask } from "@/test/wails-mock";

const task = makeTask({ stage: "implementation", currentStep: 1 });

function strip(review: Review | null, step: Partial<Step> = {}) {
  return renderWithStore(<ReviewStrip task={task} step={makeStep({ review, ...step })} />, {
    state: makeState({ tasks: [task] }),
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("ReviewStrip", () => {
  it("shows nothing while the step has no review", () => {
    const { container } = strip(null);

    expect(container).toBeEmptyDOMElement();
  });

  it("carries the progress of the review in the bar and in the count", () => {
    strip(makeReview({ staged: 3, total: 5, percent: 60 }));

    const bar = screen.getByRole("progressbar", { name: "Review progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "60");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("3 of 5 files staged")).toBeInTheDocument();
  });

  it("lists every changed file with its kind and its state", () => {
    strip(makeReview());

    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first as HTMLElement).getByText("src/LoginForm.tsx")).toBeInTheDocument();
    expect(within(first as HTMLElement).getByText("M")).toBeInTheDocument();
    expect(within(first as HTMLElement).getByText("Staged")).toBeInTheDocument();
    expect(within(second as HTMLElement).getByText("A")).toBeInTheDocument();
    expect(within(second as HTMLElement).getByText("Pending")).toBeInTheDocument();
  });

  it("opens a file of the list in the editor", async () => {
    const { user } = strip(makeReview());

    await user.click(screen.getByRole("button", { name: /src\/LoginForm.tsx/ }));

    expect(api.openFileInEditor).toHaveBeenCalledWith("task-1", "src/LoginForm.tsx");
  });

  it("has nothing to open for a file that was deleted", () => {
    strip(
      makeReview({
        files: [{ path: "src/old.ts", kind: "deleted", staged: true }],
        staged: 1,
        total: 1,
        percent: 100,
      }),
    );

    expect(screen.getByText("src/old.ts")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /src\/old.ts/ })).not.toBeInTheDocument();
  });

  it("folds the list away and remembers the choice", async () => {
    const { user, unmount } = strip(makeReview());

    await user.click(screen.getByRole("button", { name: "Hide files" }));
    expect(screen.queryByText("src/LoginForm.tsx")).not.toBeInTheDocument();

    unmount();
    strip(makeReview());

    expect(screen.getByRole("button", { name: "Show files" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("says what git said when the worktree could not be read", () => {
    strip(makeReview({ error: "fatal: not a git repository", files: [], staged: 0, total: 0 }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't read the worktree");
    expect(alert).toHaveTextContent("fatal: not a git repository");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("says so when the agent changed nothing", () => {
    strip(makeReview({ files: [], staged: 0, total: 0, percent: 0 }));

    expect(screen.getByText(/didn't change anything/)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
