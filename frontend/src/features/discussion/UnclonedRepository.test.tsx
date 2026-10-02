import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnclonedRepository } from "@/features/discussion/UnclonedRepository";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

function repository(overrides: Parameters<typeof makeRepository>[0] = {}) {
  return renderWithStore(
    <UnclonedRepository repository={makeRepository({ cloned: false, ...overrides })} />,
    { state: makeState() },
  );
}

describe("UnclonedRepository", () => {
  it("clones a repository without a clone", async () => {
    const { user } = repository();

    await user.click(screen.getByRole("button", { name: "Clone" }));

    expect(api.cloneRepository).toHaveBeenCalledWith("repo-1");
  });

  it("changes the path of a clone that is gone, saying where it was", async () => {
    const { user } = repository({ missing: true });

    expect(screen.getByText("The clone at /home/dev/projects/web is missing.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Change path…" }));

    expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
  });

  it("says Cloning… while the clone is under way", () => {
    repository({ cloning: true });

    expect(screen.getByRole("status")).toHaveTextContent("Cloning…");
    expect(screen.queryByRole("button", { name: "Clone" })).not.toBeInTheDocument();
  });

  it("shows the failure of the last clone", () => {
    repository({ cloneError: "no space left" });

    expect(screen.getByRole("alert")).toHaveTextContent("no space left");
  });
});
