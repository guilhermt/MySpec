import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddRepositoryDialog } from "@/features/repositories/AddRepositoryDialog";
import { api, type RepositoryCandidate } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeRepositoryCandidate, makeState } from "@/test/wails-mock";

const web = makeRepositoryCandidate();
const api2 = makeRepositoryCandidate({
  name: "api",
  fullName: "dev/api",
  path: "/home/dev/projects/api",
});
const docs = makeRepositoryCandidate({
  name: "docs",
  fullName: "dev/docs",
  path: "/home/dev/docs",
  registered: true,
});

function dialog(candidates: RepositoryCandidate[] = [api2, docs, web]) {
  vi.mocked(api.scanRepositories).mockResolvedValue(candidates);
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const result = renderWithStore(<AddRepositoryDialog open onOpenChange={onOpenChange} />, {
    state: makeState(),
  });
  return { ...result, onOpenChange };
}

describe("AddRepositoryDialog", () => {
  it("shows the scanning status, then the candidates with name and path", async () => {
    dialog();

    expect(screen.getByRole("dialog", { name: "Add repository" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Scanning your home folder…");

    expect(await screen.findByText("dev/api")).toBeInTheDocument();
    expect(screen.getByText("/home/dev/projects/api")).toBeInTheDocument();
    expect(screen.getByText("dev/web")).toBeInTheDocument();
    expect(screen.getByText("/home/dev/projects/web")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("marks a registered candidate and disables its checkbox", async () => {
    dialog();

    const checkbox = await screen.findByRole("checkbox", { name: "dev/docs" });
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Registered")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "dev/web" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("says when nothing was found", async () => {
    dialog([]);

    expect(
      await screen.findByText(
        "No GitHub clones were found in your home folder, up to 6 folders deep.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Filter repositories" })).not.toBeInTheDocument();
  });

  it("filters by name or path, and says when nothing matches", async () => {
    const { user } = dialog();
    const filter = await screen.findByRole("textbox", { name: "Filter repositories" });

    await user.type(filter, "projects/API");
    expect(screen.getByText("dev/api")).toBeInTheDocument();
    expect(screen.queryByText("dev/web")).not.toBeInTheDocument();

    await user.clear(filter);
    await user.type(filter, "nothing");
    expect(screen.getByText("No repositories match.")).toBeInTheDocument();
  });

  it("adds every checked candidate, in order, and closes", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(await screen.findByRole("checkbox", { name: "dev/web" }));
    // The whole row is the label of its checkbox.
    await user.click(screen.getByText("/home/dev/projects/api"));
    expect(screen.getByRole("checkbox", { name: "dev/api" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Add 2 repositories" }));

    expect(vi.mocked(api.addRepository).mock.calls).toEqual([
      ["/home/dev/projects/api"],
      ["/home/dev/projects/web"],
    ]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open with the refusal under its row when one addition fails", async () => {
    vi.mocked(api.addRepository).mockImplementation((path) =>
      path === api2.path
        ? Promise.reject(new Error("dev/api is already registered at /home/dev/api."))
        : Promise.resolve(),
    );
    const { user, onOpenChange } = dialog();

    await user.click(await screen.findByRole("checkbox", { name: "dev/web" }));
    await user.click(screen.getByRole("checkbox", { name: "dev/api" }));
    await user.click(screen.getByRole("button", { name: "Add 2 repositories" }));

    const refused = await screen.findByRole("alert");
    expect(refused).toHaveTextContent("dev/api is already registered at /home/dev/api.");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "dev/api" })).toBeChecked();
    const added = screen.getByRole("checkbox", { name: "dev/web" });
    expect(added).not.toBeChecked();
    expect(added).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Add repository" })).toBeEnabled();
  });

  it("shows the scan failure", async () => {
    vi.mocked(api.scanRepositories).mockRejectedValue(new Error("scan failed"));
    renderWithStore(<AddRepositoryDialog open onOpenChange={() => {}} />, { state: makeState() });

    expect(await screen.findByRole("alert")).toHaveTextContent("scan failed");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("browses with the native chooser and shows its refusal in the dialog", async () => {
    const { user, onOpenChange } = dialog();
    await screen.findByText("dev/api");

    await user.click(screen.getByRole("button", { name: "Browse…" }));
    expect(api.browseRepository).toHaveBeenCalledOnce();
    // Cancelling the chooser registers nothing, so the dialog stays.
    expect(onOpenChange).not.toHaveBeenCalled();

    vi.mocked(api.browseRepository).mockRejectedValueOnce(
      new Error("/home/dev/notes is not the root of a git repository."),
    );
    await user.click(screen.getByRole("button", { name: "Browse…" }));

    const alert = await screen.findByRole("alert");
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent("/home/dev/notes is not the root of a git repository.");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes once the native chooser registered a repository", async () => {
    vi.mocked(api.browseRepository).mockImplementationOnce(() => {
      useAppStore.setState({
        app: makeState({ repositories: [makeRepository(), makeRepository({ id: "repo-2" })] }),
      });
      return Promise.resolve();
    });
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Browse…" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
