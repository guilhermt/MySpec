import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveChecks } from "@/features/task/LiveChecks";
import type { ChecksReading } from "@/lib/pull-requests";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makePRCheck } from "@/test/wails-mock";

const READ: ChecksReading = {
  checks: [
    makePRCheck({ name: "build", state: "passed", url: "https://ci/build" }),
    makePRCheck({ name: "e2e", state: "running", url: "https://ci/e2e" }),
  ],
  mergeable: "unknown",
  checkedAt: new Date().toISOString(),
  base: "dev",
};

describe("LiveChecks", () => {
  it("says the wait with the count, when it was read and a line per check", () => {
    renderWithStore(<LiveChecks reading={READ} />);

    expect(screen.getByText("Waiting for checks · 1 of 2 passed")).toBeInTheDocument();
    expect(screen.getByText("checked just now")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });

  it("says checking GitHub before the first reading", () => {
    renderWithStore(<LiveChecks reading={{ ...READ, checks: [], checkedAt: "" }} />);

    expect(screen.getByText("checking GitHub")).toBeInTheDocument();
  });

  it("names what is missing at the foot of the block", () => {
    renderWithStore(<LiveChecks reading={READ} foot="The first pass starts when e2e finishes." />);

    expect(screen.getByText("The first pass starts when e2e finishes.")).toBeInTheDocument();
  });

  it("reads again from Refresh, saying Reading… while it runs", async () => {
    let finish = () => {};
    const onRefresh = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { user } = renderWithStore(<LiveChecks reading={READ} onRefresh={onRefresh} />);

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Reading…");
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();

    finish();
    expect(await screen.findByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("opens the check on GitHub", async () => {
    const reading = {
      ...READ,
      checks: [makePRCheck({ name: "e2e", state: "running", url: "https://ci/e2e" })],
    };
    const { user } = renderWithStore(<LiveChecks reading={reading} />);

    await user.click(screen.getByRole("link", { name: /e2e/ }));

    expect(api.openExternal).toHaveBeenCalledWith("https://ci/e2e");
  });

  it("is an entry of the feed when it is fixed at the end of a conversation", () => {
    renderWithStore(<LiveChecks reading={READ} fixed />);

    expect(
      screen.getByRole("article", { name: "Waiting for checks · 1 of 2 passed" }),
    ).toHaveAttribute("data-feed-item");
  });
});
