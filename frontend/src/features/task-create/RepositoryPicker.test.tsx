import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepositoryPicker } from "@/features/task-create/RepositoryPicker";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
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

  it("refuses a repository without a clone, and offers to clone it", async () => {
    const uncloned = makeRepository({ id: "repo-2", fullName: "dev/api", cloned: false, path: "" });
    const onChange = vi.fn();
    const { user } = renderWithStore(<RepositoryPicker value="repo-1" onChange={onChange} />, {
      state: makeState({ repositories: [WEB, uncloned] }),
    });

    await user.click(screen.getByRole("button", { name: /^Repository:/ }));
    const item = await screen.findByRole("menuitemradio", { name: /dev\/api/ });

    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("Not cloned");
    expect(screen.queryByRole("menuitem", { name: "Clone dev/web" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Clone dev/api" }));

    expect(api.cloneRepository).toHaveBeenCalledWith("repo-2");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("holds the clone of a repository that is cloning", async () => {
    const cloning = makeRepository({
      id: "repo-2",
      fullName: "dev/api",
      cloned: false,
      cloning: true,
      path: "",
    });
    const { user } = renderWithStore(<RepositoryPicker value="repo-1" onChange={vi.fn()} />, {
      state: makeState({ repositories: [WEB, cloning] }),
    });

    await user.click(screen.getByRole("button", { name: /^Repository:/ }));

    expect(await screen.findByRole("menuitemradio", { name: /dev\/api/ })).toHaveTextContent(
      "Cloning…",
    );
    expect(screen.getByRole("menuitem", { name: "Clone dev/api" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows a clone that could not start under the picker", async () => {
    vi.mocked(api.cloneRepository).mockRejectedValueOnce(new Error("Choose a clone folder first."));
    const uncloned = makeRepository({ id: "repo-2", fullName: "dev/api", cloned: false, path: "" });
    const { user } = renderWithStore(<RepositoryPicker value="repo-1" onChange={vi.fn()} />, {
      state: makeState({ repositories: [WEB, uncloned] }),
    });

    await user.click(screen.getByRole("button", { name: /^Repository:/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Clone dev/api" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a clone folder first.");
    expect(useAppStore.getState().error).toBeNull();
  });

  it("says why the last clone of a repository failed", async () => {
    const failed = makeRepository({
      id: "repo-2",
      fullName: "dev/api",
      cloned: false,
      path: "",
      cloneError: "gh: repository not found",
    });
    const { user } = renderWithStore(<RepositoryPicker value="repo-1" onChange={vi.fn()} />, {
      state: makeState({ repositories: [WEB, failed] }),
    });

    await user.click(screen.getByRole("button", { name: /^Repository:/ }));
    const item = await screen.findByRole("menuitemradio", { name: /dev\/api/ });

    expect(item).toHaveTextContent("Not cloned");
    expect(item).toHaveTextContent("gh: repository not found");
  });
});
