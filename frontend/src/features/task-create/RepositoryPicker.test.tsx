import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepositoryPicker } from "@/features/task-create/RepositoryPicker";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

const WEB = makeRepository();
const API = makeRepository({
  id: "repo-2",
  name: "api",
  fullName: "dev/api",
  path: "/home/dev/projects/api",
});

function picker(value: string, onChange = vi.fn()) {
  return {
    onChange,
    ...renderWithStore(<RepositoryPicker value={value} onChange={onChange} />, {
      state: makeState({ repositories: [WEB, API] }),
    }),
  };
}

describe("RepositoryPicker", () => {
  it("names the repository that is chosen", () => {
    picker("repo-2");

    expect(screen.getByRole("button", { name: "Repository: dev/api" })).toBeInTheDocument();
  });

  it("asks for a repository while none is chosen", () => {
    picker("");

    expect(
      screen.getByRole("button", { name: "Repository: Choose a repository" }),
    ).toBeInTheDocument();
  });

  it("hands the chosen repository back", async () => {
    const { user, onChange } = picker("repo-1");

    await user.click(screen.getByRole("button", { name: /^Repository:/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "dev/api" }));

    expect(onChange).toHaveBeenCalledWith("repo-2");
  });

  it("refuses a repository whose clone is missing, and says why", async () => {
    const gone = makeRepository({
      id: "repo-2",
      fullName: "dev/api",
      path: "/home/dev/projects/api",
      missing: true,
    });
    const onChange = vi.fn();
    const { user } = renderWithStore(<RepositoryPicker value="repo-1" onChange={onChange} />, {
      state: makeState({ repositories: [WEB, gone] }),
    });

    await user.click(screen.getByRole("button", { name: /^Repository:/ }));
    const item = await screen.findByRole("menuitemradio", { name: /dev\/api/ });

    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("The clone at /home/dev/projects/api is missing.");
  });
});
