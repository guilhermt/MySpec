import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MissingClones } from "@/features/sidebar/MissingClones";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

const REPOSITORIES = [
  makeRepository({ missing: true }),
  makeRepository({
    id: "repo-2",
    name: "api",
    fullName: "dev/api",
    path: "/home/dev/projects/api",
    missing: true,
  }),
  makeRepository({ id: "repo-3", name: "docs", fullName: "dev/docs" }),
];

function clones(filter = "") {
  return renderWithStore(<MissingClones />, {
    state: makeState({ repositories: REPOSITORIES, repositoryFilter: filter }),
  });
}

describe("MissingClones", () => {
  it("warns about every missing clone the filter shows", () => {
    clones();

    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getByText("The clone at /home/dev/projects/web is missing.")).toBeInTheDocument();
    expect(screen.getByText("The clone at /home/dev/projects/api is missing.")).toBeInTheDocument();
  });

  it("warns only about the repository of the filter", () => {
    clones("repo-2");

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("The clone at /home/dev/projects/api is missing.")).toBeInTheDocument();
  });

  it("says nothing when every clone is there", () => {
    renderWithStore(<MissingClones />, { state: makeState() });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("points the repository at another clone", async () => {
    const { user } = clones("repo-2");

    await user.click(screen.getByRole("button", { name: "Change path" }));

    expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-2");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a clone the app refuses, where the user is", async () => {
    vi.mocked(api.changeRepositoryPath).mockRejectedValueOnce(
      new Error("/home/dev/other is a clone of dev/other."),
    );
    const { user } = clones("repo-2");

    await user.click(screen.getByRole("button", { name: "Change path" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "/home/dev/other is a clone of dev/other.",
    );
  });
});
