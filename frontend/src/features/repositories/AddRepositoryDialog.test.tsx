import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddRepositoryDialog } from "@/features/repositories/AddRepositoryDialog";
import { api, type RepositoryCandidate } from "@/lib/wails";
import { spoken } from "@/test/live";
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

function dialog(
  candidates: RepositoryCandidate[] = [web, docs, api2],
  repositories = [makeRepository({ fullName: "dev/docs", path: "/home/dev/docs" })],
) {
  vi.mocked(api.scanRepositories).mockResolvedValue(candidates);
  const onOpenChange = vi.fn<(open: boolean) => void>();
  const result = renderWithStore(<AddRepositoryDialog open onOpenChange={onOpenChange} />, {
    state: makeState({ repositories }),
  });
  return { ...result, onOpenChange };
}

const FILTER = { name: "Filter by name or path" };
const ADD = { name: "Add repository" };

describe("AddRepositoryDialog", () => {
  it("shows the scanning status with the primary waiting, then the list with the filter focused", async () => {
    dialog();

    const sheet = screen.getByRole("dialog", { name: "Add repository" });
    expect(sheet).toHaveTextContent(
      "Pick the clones to register. The scan looks through your home folder, up to 6 folders deep.",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Scanning your home folder…");
    const primary = screen.getByRole("button", ADD);
    expect(primary).toHaveAttribute("aria-disabled", "true");
    expect(primary).toHaveAccessibleDescription("Wait for the scan to end.");

    expect(await screen.findByRole("checkbox", { name: "dev/web ~/projects/web" })).toBeVisible();
    expect(spoken()).toEqual([]);
    await waitFor(() => expect(screen.getByRole("searchbox", FILTER)).toHaveFocus());
    expect(screen.getByRole("button", ADD)).toHaveAccessibleDescription("Check the clones to add.");
  });

  it("lists the available clones alphabetically and folds the registered ones", async () => {
    const { user } = dialog();

    await screen.findByRole("checkbox", { name: "dev/web ~/projects/web" });
    const available = screen
      .getAllByRole("checkbox")
      .map((box) => box.textContent?.replace(/\s+/g, " "));
    expect(available).toEqual(["dev/api ~/projects/api", "dev/web ~/projects/web"]);

    const folded = screen.getByRole("button", { name: "Already registered 1" });
    expect(folded).toHaveAttribute("aria-expanded", "false");
    await user.click(folded);
    const registered = screen.getByRole("checkbox", { name: "dev/docs ~/docs" });
    expect(registered).toHaveAttribute("aria-disabled", "true");
  });

  it("says a clone links to a repository registered without a clone", async () => {
    dialog([web], [makeRepository({ id: "repo-9", fullName: "Dev/Web", path: "", cloned: false })]);

    const box = await screen.findByRole("checkbox", { name: "dev/web ~/projects/web" });
    expect(box).toHaveAccessibleDescription(
      "Registered without a clone: this links the clone to it.",
    );
  });

  it("says when nothing was found", async () => {
    dialog([]);

    expect(
      await screen.findByText(
        "No GitHub clones were found in your home folder, up to 6 folders deep.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", FILTER)).not.toBeInTheDocument();
  });

  it("filters both groups by name or path, and says when nothing matches", async () => {
    const { user } = dialog();
    const filter = await screen.findByRole("searchbox", FILTER);

    await user.type(filter, "projects/API");
    expect(screen.getByText("dev/api")).toBeInTheDocument();
    expect(screen.queryByText("dev/web")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Already registered/ })).not.toBeInTheDocument();

    await user.clear(filter);
    await user.type(filter, "DOCS");
    expect(screen.getByRole("button", { name: "Already registered 1" })).toBeInTheDocument();

    await user.clear(filter);
    await user.type(filter, "nothing");
    expect(screen.getByText("No repositories match.")).toBeInTheDocument();
  });

  it("adds every checked clone, in the order of the list, and closes", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(await screen.findByRole("checkbox", { name: "dev/web ~/projects/web" }));
    await user.click(screen.getByRole("checkbox", { name: "dev/api ~/projects/api" }));
    await user.click(screen.getByRole("button", { name: "Add 2 repositories" }));

    expect(vi.mocked(api.addRepository).mock.calls).toEqual([
      ["/home/dev/projects/api"],
      ["/home/dev/projects/web"],
    ]);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("adds with Ctrl Enter", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(await screen.findByRole("checkbox", { name: "dev/web ~/projects/web" }));
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.addRepository).toHaveBeenCalledWith("/home/dev/projects/web");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("puts a spinner on the row being added and dashes Cancel and Browse until the last", async () => {
    let finish: () => void = () => {};
    vi.mocked(api.addRepository).mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const { user } = dialog();

    await user.click(await screen.findByRole("checkbox", { name: "dev/web ~/projects/web" }));
    await user.click(screen.getByRole("button", ADD));

    expect(screen.getByRole("checkbox", { name: "dev/web ~/projects/web" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Browse…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Adding…" })).toBeInTheDocument();
    finish();
  });

  it("stays open with the refusal under its row, and the clones that passed disabled with Registered", async () => {
    vi.mocked(api.addRepository).mockImplementation((path) =>
      path === api2.path
        ? Promise.reject(new Error("dev/api is already registered at /home/dev/api."))
        : Promise.resolve(),
    );
    const { user, onOpenChange } = dialog();

    await user.click(await screen.findByRole("checkbox", { name: "dev/web ~/projects/web" }));
    await user.click(screen.getByRole("checkbox", { name: "dev/api ~/projects/api" }));
    await user.click(screen.getByRole("button", { name: "Add 2 repositories" }));

    const refused = await screen.findByRole("alert");
    expect(refused).toHaveTextContent("dev/api is already registered at ~/api.");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "dev/api ~/projects/api" })).toBeChecked();
    const added = screen.getByRole("checkbox", { name: "dev/web Registered ~/projects/web" });
    expect(added).not.toBeChecked();
    expect(added).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", ADD)).not.toHaveAttribute("aria-disabled", "true");
  });

  it("shows the scan failure and scans again with Try again", async () => {
    vi.mocked(api.scanRepositories).mockRejectedValueOnce(new Error("read /home/dev: denied"));
    const { user } = dialog();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't scan your home folder: read ~: denied",
    );
    expect(spoken()).toEqual([]);
    expect(screen.getByRole("button", { name: "Browse…" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("checkbox", { name: "dev/web ~/projects/web" })).toBeVisible();
    expect(api.scanRepositories).toHaveBeenCalledTimes(2);
  });

  it("browses with the native chooser and shows its refusal above the buttons", async () => {
    const { user, onOpenChange } = dialog();
    await screen.findByText("dev/api");

    await user.click(screen.getByRole("button", { name: "Browse…" }));
    expect(api.browseRepository).toHaveBeenCalledOnce();
    // Cancelling the chooser registers nothing, so the dialog stays.
    expect(onOpenChange).not.toHaveBeenCalled();

    vi.mocked(api.browseRepository).mockRejectedValueOnce(
      new Error("/home/dev/Downloads/site is not the root of a git repository."),
    );
    await user.click(screen.getByRole("button", { name: "Browse…" }));

    const alert = await screen.findByRole("alert");
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent("~/Downloads/site is not the root of a git repository.");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes once the native chooser registered a repository", async () => {
    vi.mocked(api.browseRepository).mockResolvedValueOnce(true);
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Browse…" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
