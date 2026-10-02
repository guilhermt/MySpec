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

  describe("as a strip", () => {
    function strip(overrides: Parameters<typeof makeRepository>[0] = {}) {
      return renderWithStore(
        <UnclonedRepository
          layout="strip"
          repository={makeRepository({ cloned: false, ...overrides })}
        />,
        { state: makeState() },
      );
    }

    it("says what the conversation reads and offers the clone", async () => {
      const { user } = strip();

      expect(screen.getByText("dev/web isn't cloned.")).toBeInTheDocument();
      expect(
        screen.getByText("The conversation reads the code of the cloned repositories only."),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Clone" }));

      expect(api.cloneRepository).toHaveBeenCalledWith("repo-1");
    });

    it("says Cloning dev/web… while the clone is under way", () => {
      strip({ cloning: true });

      expect(screen.getByRole("status")).toHaveTextContent("Cloning dev/web…");
    });

    it("shows the failure and offers to try the clone again", () => {
      strip({ cloneError: "no space left" });

      expect(screen.getByRole("alert")).toHaveTextContent("no space left");
      expect(screen.getByRole("button", { name: "Try the clone again" })).toBeInTheDocument();
    });

    it("asks for the path of a clone that is gone", async () => {
      const { user } = strip({ missing: true });

      expect(
        screen.getByText("The clone of dev/web at /home/dev/projects/web is missing."),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Change path…" }));

      expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
    });
  });
});
