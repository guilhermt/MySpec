import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepositoryFilter } from "@/features/sidebar/RepositoryFilter";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

const WEB = makeRepository();
const API = makeRepository({
  id: "repo-2",
  name: "api",
  fullName: "dev/api",
  path: "/home/dev/projects/api",
  missing: true,
});

function filter(chosen = "") {
  return renderWithStore(<RepositoryFilter />, {
    state: makeState({ repositories: [WEB, API], repositoryFilter: chosen }),
  });
}

describe("RepositoryFilter", () => {
  it("names what it shows", () => {
    filter();

    expect(
      screen.getByRole("button", { name: "Repository filter: All repositories" }),
    ).toBeInTheDocument();
  });

  it("names the repository of the filter", () => {
    filter("repo-1");

    expect(screen.getByRole("button", { name: "Repository filter: dev/web" })).toBeInTheDocument();
  });

  it("chooses a repository", async () => {
    const { user } = filter();

    await user.click(screen.getByRole("button", { name: /^Repository filter:/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: /dev\/web/ }));

    expect(api.setRepositoryFilter).toHaveBeenCalledWith("repo-1");
  });

  it("goes back to every repository", async () => {
    const { user } = filter("repo-1");

    await user.click(screen.getByRole("button", { name: /^Repository filter:/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "All repositories" }));

    expect(api.setRepositoryFilter).toHaveBeenCalledWith("");
  });

  it("announces a repository whose clone is missing", async () => {
    const { user } = filter();

    await user.click(screen.getByRole("button", { name: /^Repository filter:/ }));

    expect(
      await screen.findByRole("menuitemradio", { name: /dev\/api.*clone missing/ }),
    ).toBeInTheDocument();
  });
});
