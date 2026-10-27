import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeploysDialog } from "@/features/boards/DeploysDialog";
import { api, type DeployEnvironmentSettings, type DeployRepositoryOptions } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeDeployRepositoryOptions,
  makeDeploySettings,
  makeState,
} from "@/test/wails-mock";

function environment(name: string, branch: string, workflowId = 0): DeployEnvironmentSettings {
  return {
    name,
    branch,
    workflowId,
    workflowName: workflowId === 0 ? "" : "Deploy",
    workflowPath: workflowId === 0 ? "" : ".github/workflows/deploy.yml",
  };
}

const DEFAULTS = [
  environment("Development", "dev"),
  environment("Staging", "staging"),
  environment("Production", "main"),
];

const OPTIONS: DeployRepositoryOptions = makeDeployRepositoryOptions({
  workflows: [
    { id: 7, name: "Deploy staging", path: ".github/workflows/staging.yml" },
    { id: 9, name: "Release", path: ".github/workflows/release.yml" },
  ],
  branches: [
    { branch: "dev", exists: true, suggested: 0 },
    { branch: "staging", exists: false, suggested: 7 },
    { branch: "main", exists: true, suggested: 9 },
  ],
});

function settings(managed: boolean) {
  return makeDeploySettings({
    configured: managed,
    enabled: managed,
    repositories: [
      { repositoryId: "r-web", fullName: "dev/web", managed: false, environments: DEFAULTS },
      { repositoryId: "r-api", fullName: "dev/api", managed, environments: DEFAULTS },
    ],
  });
}

function dialog() {
  const onOpenChange = vi.fn();
  const rendered = renderWithStore(
    <DeploysDialog board={makeBoard()} open onOpenChange={onOpenChange} />,
    { state: makeState({ boards: [makeBoard()] }) },
  );
  return { ...rendered, onOpenChange };
}

const NAME = (n: number) => `Name of environment ${n} of dev/api`;

describe("DeploysDialog", () => {
  it("reads the settings of the board, then GitHub for each repository it manages", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(true));
    vi.mocked(api.readDeployRepository).mockResolvedValue(OPTIONS);
    dialog();

    expect(screen.getByRole("dialog", { name: "Deploys of Roadmap" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Reading the deploys of the board…" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("checkbox", { name: /Manage the deploys/ })).toBeChecked();
    expect(api.deploySettings).toHaveBeenCalledWith("board-1");
    await waitFor(() => expect(api.readDeployRepository).toHaveBeenCalledTimes(1));
    expect(api.readDeployRepository).toHaveBeenCalledWith("r-api", ["dev", "staging", "main"]);
  });

  it("starts the focus on the checkbox that manages the deploys", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(true));
    dialog();

    const checkbox = await screen.findByRole("checkbox", { name: /Manage the deploys/ });

    await waitFor(() => expect(checkbox).toHaveFocus());
  });

  it("shows the failure to read the settings, and reads them again on Try again", async () => {
    vi.mocked(api.deploySettings).mockRejectedValueOnce(new Error("The database is locked."));
    vi.mocked(api.deploySettings).mockResolvedValue(settings(false));
    const { user } = dialog();

    expect(await screen.findByRole("alert")).toHaveTextContent("The database is locked.");
    await user.click(screen.getByRole("button", { name: /Try again/ }));

    expect(await screen.findByRole("checkbox", { name: /Manage the deploys/ })).toBeInTheDocument();
    expect(api.deploySettings).toHaveBeenCalledTimes(2);
  });

  it("lists the repositories alphabetically and shows the environments of the managed ones only", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(true));
    vi.mocked(api.readDeployRepository).mockResolvedValue(OPTIONS);
    dialog();

    await screen.findByRole("checkbox", { name: "dev/api" });

    const names = screen
      .getAllByRole("checkbox")
      .map((each) => each.getAttribute("aria-label") ?? each.textContent);
    expect(names.indexOf("dev/api")).toBeLessThan(names.indexOf("dev/web"));
    expect(screen.getByRole("textbox", { name: NAME(1) })).toHaveValue("Development");
    expect(screen.queryByRole("textbox", { name: "Name of environment 1 of dev/web" })).toBeNull();
  });

  it("reads GitHub when a repository is checked, with the defaults to edit", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(false));
    vi.mocked(api.readDeployRepository).mockResolvedValue(OPTIONS);
    const { user } = dialog();

    await user.click(await screen.findByRole("checkbox", { name: "dev/api" }));

    expect(await screen.findByRole("textbox", { name: NAME(3) })).toHaveValue("Production");
    expect(api.readDeployRepository).toHaveBeenCalledWith("r-api", ["dev", "staging", "main"]);
  });

  it("gives the suggested workflow to the environments that have none", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(true));
    vi.mocked(api.readDeployRepository).mockResolvedValue(OPTIONS);
    dialog();

    expect(
      await screen.findByRole("button", {
        name: "Workflow of environment 2 of dev/api: Deploy staging",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Workflow of environment 3 of dev/api: Release" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Workflow of environment 1 of dev/api: Choose a workflow",
      }),
    ).toBeInTheDocument();
  });

  it("warns, without blocking, of a branch GitHub doesn't have", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(true));
    vi.mocked(api.readDeployRepository).mockResolvedValue(OPTIONS);
    dialog();

    expect(await screen.findByText("No branch staging on GitHub.")).toBeInTheDocument();
  });

  it("reads GitHub again when a branch is changed, keeping the workflows already chosen", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(true));
    vi.mocked(api.readDeployRepository).mockResolvedValue(OPTIONS);
    const { user } = dialog();
    const branch = await screen.findByRole("textbox", {
      name: "Branch of environment 1 of dev/api",
    });
    await screen.findByText("No branch staging on GitHub.");

    await user.clear(branch);
    await user.type(branch, "develop");
    await user.tab();

    await waitFor(() =>
      expect(api.readDeployRepository).toHaveBeenLastCalledWith("r-api", [
        "develop",
        "staging",
        "main",
      ]),
    );
    expect(
      screen.getByRole("button", {
        name: "Workflow of environment 2 of dev/api: Deploy staging",
      }),
    ).toBeInTheDocument();
  });

  it("moves an environment and keeps the focus on the button that moved it", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(true));
    vi.mocked(api.readDeployRepository).mockResolvedValue(OPTIONS);
    const { user } = dialog();

    const checkbox = await screen.findByRole("checkbox", { name: /Manage the deploys/ });
    await waitFor(() => expect(checkbox).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Move up environment 2 of dev/api" }));

    expect(screen.getByRole("textbox", { name: NAME(1) })).toHaveValue("Staging");
    expect(screen.getByRole("textbox", { name: NAME(2) })).toHaveValue("Development");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Move up environment 1 of dev/api" }),
      ).toHaveFocus(),
    );
  });

  it("can't take an environment out below two, and says why", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(true));
    vi.mocked(api.readDeployRepository).mockResolvedValue(OPTIONS);
    const { user } = dialog();
    await user.click(
      await screen.findByRole("button", { name: "Remove environment 3 of dev/api" }),
    );

    const remove = screen.getByRole("button", { name: "Remove environment 2 of dev/api" });

    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).toHaveAccessibleDescription("A repository needs at least two environments.");
  });

  it("adds an environment, and Save waits for it to be filled", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(true));
    vi.mocked(api.readDeployRepository).mockResolvedValue(OPTIONS);
    const { user } = dialog();
    await screen.findByRole("button", { name: "Workflow of environment 3 of dev/api: Release" });
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-disabled", "true");
    // Development has no workflow yet.
    expect(
      screen.getByText("Choose the workflow of every environment of dev/api."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add environment to dev/api" }));

    expect(screen.getByRole("textbox", { name: NAME(4) })).toHaveValue("");
  });

  it("keeps the edits of a repository that is unchecked and checked again", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(true));
    vi.mocked(api.readDeployRepository).mockResolvedValue(OPTIONS);
    const { user } = dialog();
    const name = await screen.findByRole("textbox", { name: NAME(1) });
    await user.clear(name);
    await user.type(name, "Dev");

    await user.click(screen.getByRole("checkbox", { name: "dev/api" }));
    expect(screen.queryByRole("textbox", { name: NAME(1) })).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "dev/api" }));

    expect(await screen.findByRole("textbox", { name: NAME(1) })).toHaveValue("Dev");
  });

  it("says what couldn't be read of a repository and reads it again, with the fields editable", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(settings(true));
    vi.mocked(api.readDeployRepository).mockResolvedValueOnce(
      makeDeployRepositoryOptions({ failure: "gh: rate limited" }),
    );
    vi.mocked(api.readDeployRepository).mockResolvedValue(OPTIONS);
    const { user } = dialog();

    expect(await screen.findByText("Couldn't read dev/api: gh: rate limited")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: NAME(1) })).toBeEnabled();
    expect(
      screen.getAllByRole("button", { name: /^Workflow of environment 1 of dev\/api/ })[0],
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("The workflows couldn't be read.").length).toBeGreaterThan(0);

    const line = screen.getByText("Couldn't read dev/api: gh: rate limited").parentElement;
    await user.click(within(line as HTMLElement).getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(screen.queryByText(/Couldn't read dev\/api/)).not.toBeInTheDocument(),
    );
  });

  it("saves the managed repositories and closes", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(
      makeDeploySettings({
        configured: true,
        enabled: true,
        repositories: [
          {
            repositoryId: "r-api",
            fullName: "dev/api",
            managed: true,
            environments: [environment("Dev", "dev", 7), environment("Prod", "main", 9)],
          },
          { repositoryId: "r-web", fullName: "dev/web", managed: false, environments: DEFAULTS },
        ],
      }),
    );
    vi.mocked(api.readDeployRepository).mockResolvedValue(makeDeployRepositoryOptions());
    const { user, onOpenChange } = dialog();

    await user.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(api.saveDeploySettings).toHaveBeenCalledWith({
      boardId: "board-1",
      enabled: true,
      repositories: [
        {
          repositoryId: "r-api",
          environments: [environment("Dev", "dev", 7), environment("Prod", "main", 9)],
        },
      ],
    });
  });

  it("keeps the dialog open and tells the refusal in the footer", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(
      makeDeploySettings({
        repositories: [
          {
            repositoryId: "r-api",
            fullName: "dev/api",
            managed: true,
            environments: [environment("Dev", "dev", 7), environment("Prod", "main", 9)],
          },
        ],
      }),
    );
    vi.mocked(api.saveDeploySettings).mockRejectedValue(
      new Error("Two environments share a branch."),
    );
    const { user, onOpenChange } = dialog();

    await user.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Two environments share a branch.");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("confirms with Ctrl+Enter", async () => {
    vi.mocked(api.deploySettings).mockResolvedValue(
      makeDeploySettings({
        repositories: [
          {
            repositoryId: "r-api",
            fullName: "dev/api",
            managed: false,
            environments: DEFAULTS,
          },
        ],
      }),
    );
    const { user } = dialog();
    await screen.findByRole("checkbox", { name: "dev/api" });

    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => expect(api.saveDeploySettings).toHaveBeenCalled());
  });
});
