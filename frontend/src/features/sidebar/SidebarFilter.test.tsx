import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarFilter } from "@/features/sidebar/SidebarFilter";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

const WEB = makeRepository({ id: "web", fullName: "dev/web" });
const API = makeRepository({ id: "api", fullName: "dev/api", missing: true });
const DOCS = makeRepository({ id: "docs", fullName: "acme/docs", cloned: false });

function filter(chosen = "") {
  return renderWithStore(<SidebarFilter />, {
    state: makeState({ repositories: [WEB, API, DOCS], repositoryFilter: chosen }),
  });
}

async function openFilter(chosen = "") {
  const rendered = filter(chosen);
  await rendered.user.click(screen.getByRole("button", { name: /^Repository filter:/ }));
  await screen.findByRole("menu");
  return rendered;
}

describe("SidebarFilter", () => {
  it("names every repository when it shows them all", () => {
    filter();

    expect(
      screen.getByRole("button", { name: "Repository filter: All repositories" }),
    ).toBeInTheDocument();
  });

  it("names the repository it shows", () => {
    filter("web");

    expect(screen.getByRole("button", { name: "Repository filter: dev/web" })).toBeInTheDocument();
  });

  it("offers every repository in alphabetical order, with what keeps it from being worked on", async () => {
    await openFilter();

    expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual([
      "All repositories",
      "acme/docs · not cloned",
      "dev/api · clone missing",
      "dev/web",
    ]);
  });

  it("chooses a repository", async () => {
    const { user } = await openFilter();

    await user.click(screen.getByRole("menuitemradio", { name: "dev/web" }));

    expect(api.setRepositoryFilter).toHaveBeenCalledWith("web");
  });

  it("goes back to every repository", async () => {
    const { user } = await openFilter("web");

    await user.click(screen.getByRole("menuitemradio", { name: "All repositories" }));

    expect(api.setRepositoryFilter).toHaveBeenCalledWith("");
  });
});
