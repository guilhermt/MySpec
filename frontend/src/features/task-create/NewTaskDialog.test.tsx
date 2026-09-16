import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewTaskDialog } from "@/features/task-create/NewTaskDialog";
import { api, type State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, type StoreOptions } from "@/test/render";
import {
  makeArchivedTask,
  makeModelDefaults,
  makeRepository,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const WEB = makeRepository();
const API = makeRepository({
  id: "repo-2",
  name: "api",
  fullName: "dev/api",
  path: "/home/dev/projects/api",
});

function open(state: Partial<State> = {}, ui: StoreOptions["ui"] = {}) {
  return renderWithStore(<NewTaskDialog />, {
    state: makeState({ repositories: [WEB, API], ...state }),
    ui: { newTaskOpen: true, ...ui },
  });
}

describe("NewTaskDialog", () => {
  it("stays closed until something asks for it", () => {
    renderWithStore(<NewTaskDialog />, { state: makeState() });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on the repository of the filter", () => {
    open({ repositoryFilter: "repo-2" });

    expect(screen.getByRole("heading", { name: "New task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repository: dev/api" })).toBeInTheDocument();
  });

  it("opens on the repository of the open task when the filter shows them all", () => {
    const task = makeTask({ repositoryId: "repo-2", repository: "dev/api" });

    open({ tasks: [task] }, { openTaskId: task.id });

    expect(screen.getByRole("button", { name: "Repository: dev/api" })).toBeInTheDocument();
  });

  it("opens on the repository of the last task created", () => {
    open({}, { lastRepositoryId: "repo-2" });

    expect(screen.getByRole("button", { name: "Repository: dev/api" })).toBeInTheDocument();
  });

  it("opens on the first repository when nothing else says", () => {
    open();

    expect(screen.getByRole("button", { name: "Repository: dev/web" })).toBeInTheDocument();
  });

  it("offers no repository whose clone is missing", async () => {
    const gone = makeRepository({
      id: "repo-2",
      fullName: "dev/api",
      path: "/home/dev/projects/api",
      missing: true,
    });
    const { user } = open({ repositories: [WEB, gone] });

    await user.click(screen.getByRole("button", { name: "Repository: dev/web" }));

    const item = await screen.findByRole("menuitemradio", { name: /dev\/api/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("The clone at /home/dev/projects/api is missing.");
  });

  it("changes the repository the task will belong to", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: "Repository: dev/web" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "dev/api" }));

    expect(screen.getByRole("button", { name: "Repository: dev/api" })).toBeInTheDocument();
  });

  it("offers the normalised name of what was typed", async () => {
    const { user } = open();

    await user.type(screen.getByLabelText("Name"), "Minha Feature!");

    expect(screen.getByText("Use lowercase letters, digits and single hyphens.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: 'Use "minha-feature"' }));

    expect(screen.getByLabelText("Name")).toHaveValue("minha-feature");
    expect(screen.getByText("Lowercase letters, digits and hyphens.")).toBeVisible();
  });

  it("refuses a name another task of the repository already has", async () => {
    const { user } = open({ tasks: [makeTask({ name: "add-login" })] });

    await user.type(screen.getByLabelText("Name"), "add-login");

    expect(screen.getByText("A task named add-login already exists in dev/web.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("refuses a name an archived task of the repository already has", async () => {
    const { user } = open({ history: [makeArchivedTask({ name: "add-login" })] });

    await user.type(screen.getByLabelText("Name"), "add-login");

    expect(screen.getByText("A task named add-login already exists in dev/web.")).toBeVisible();
  });

  it("takes the same name in another repository", async () => {
    const { user } = open({ tasks: [makeTask({ name: "add-login" })] });

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.click(screen.getByRole("button", { name: "Repository: dev/web" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "dev/api" }));

    expect(
      screen.queryByText("A task named add-login already exists in dev/web."),
    ).not.toBeInTheDocument();
  });

  // With every clone missing the dialog opens on no repository at all; the
  // names of the other repositories are none of this task's business yet.
  it("takes any name while no repository is chosen", async () => {
    const gone = makeRepository({ missing: true });
    const alsoGone = makeRepository({
      id: "repo-2",
      fullName: "dev/api",
      path: "/home/dev/projects/api",
      missing: true,
    });
    const { user } = open({
      repositories: [gone, alsoGone],
      tasks: [makeTask({ name: "add-login" })],
    });

    expect(
      screen.getByRole("button", { name: "Repository: Choose a repository" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "add-login");

    expect(screen.getByText("Lowercase letters, digits and hyphens.")).toBeVisible();
    expect(screen.queryByText(/already exists in/)).not.toBeInTheDocument();
  });

  it("keeps Create out of reach until both fields are filled", async () => {
    const { user } = open();
    const create = screen.getByRole("button", { name: "Create" });

    expect(create).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "add-login");
    expect(create).toBeDisabled();

    await user.type(screen.getByLabelText("Initial context"), "   ");
    expect(create).toBeDisabled();

    await user.type(screen.getByLabelText("Initial context"), "A login screen");
    expect(create).toBeEnabled();
  });

  it("creates the task in the repository that was chosen and opens it", async () => {
    vi.mocked(api.createTask).mockResolvedValue("task-9");
    const { user } = open();

    await user.click(screen.getByRole("button", { name: "Repository: dev/web" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "dev/api" }));
    await user.type(screen.getByLabelText("Name"), "fix-header");
    await user.type(screen.getByLabelText("Initial context"), "The header overlaps the menu");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(useAppStore.getState().openTaskId).toBe("task-9");
    });
    expect(api.createTask).toHaveBeenCalledWith({
      name: "fix-header",
      repositoryId: "repo-2",
      initialContext: "The header overlaps the menu",
      mode: "structured",
      models: makeModelDefaults(),
      reviewMode: "manual",
      card: null,
    });
    expect(useAppStore.getState().newTaskOpen).toBe(false);
    expect(useAppStore.getState().lastRepositoryId).toBe("repo-2");
  });

  it("folds the models under a summary of the defaults", () => {
    open();

    expect(screen.getByRole("button", { name: /Models/ })).toHaveTextContent("Defaults");
    expect(screen.queryByRole("button", { name: /PRD model:/ })).not.toBeInTheDocument();
  });

  it("sums up what was adjusted", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: /Models/ }));
    await user.click(await screen.findByRole("button", { name: "PRD model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));

    expect(screen.getByRole("button", { name: /Models/ })).toHaveTextContent(
      "PRD: Fable 5.1 · xhigh",
    );
    // The menu of the picker is a child popup of the dialog: a click in it
    // leaves the dialog open.
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Plan model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "max" }));

    expect(screen.getByRole("button", { name: /Models/ })).toHaveTextContent(
      "PRD: Fable 5.1 · xhigh +1",
    );
  });

  it("creates the task with the models of the dialog", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: /Models/ }));
    await user.click(await screen.findByRole("button", { name: "PRD model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));
    await user.keyboard("{Escape}");

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Initial context"), "A login screen");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledOnce();
    });
    expect(api.createTask).toHaveBeenCalledWith({
      name: "add-login",
      repositoryId: "repo-1",
      initialContext: "A login screen",
      mode: "structured",
      models: makeModelDefaults().map((line) =>
        line.stage === "prd" ? { ...line, effort: "xhigh" } : line,
      ),
      reviewMode: "manual",
      card: null,
    });
  });

  it("creates from the defaults when nothing was adjusted", async () => {
    const { user } = open();

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Initial context"), "A login screen");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledWith({
        name: "add-login",
        repositoryId: "repo-1",
        initialContext: "A login screen",
        mode: "structured",
        models: makeModelDefaults(),
        reviewMode: "manual",
        card: null,
      });
    });
  });

  it("starts from the review mode of the settings and says what it does", () => {
    open({ reviewModeDefault: "agent" });

    expect(screen.getByRole("button", { name: "Task review mode: Agent" })).toHaveTextContent(
      "Agent",
    );
    expect(
      screen.getByText(
        "An agent reviews each step, and the task runs to the pull request on its own.",
      ),
    ).toBeInTheDocument();
  });

  it("creates the task with the review mode of the dialog", async () => {
    const { user } = open();

    expect(
      screen.getByText("You review each step in VS Code before its commit."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Task review mode: Manual" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Agent" }));
    // The menu is a child popup of the dialog: a click in it leaves the dialog open.
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Initial context"), "A login screen");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledWith({
        name: "add-login",
        repositoryId: "repo-1",
        initialContext: "A login screen",
        mode: "structured",
        models: makeModelDefaults(),
        reviewMode: "agent",
        card: null,
      });
    });
  });

  it("opens on the Structured mode and says what it does", () => {
    open();

    const modes = screen.getByRole("group", { name: "Mode" });
    expect(within(modes).getByRole("button", { name: "Structured" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(modes).getByRole("button", { name: "One-Shot" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByText("A PRD, a tech spec and a plan of steps, each step its own commit."),
    ).toBeInTheDocument();
    expect(within(modes).getByRole("button", { name: "One-Shot" })).toBeEnabled();
  });

  it("switches the hint and the models to the One-Shot mode", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: /Models/ }));
    await user.click(screen.getByRole("button", { name: "One-Shot" }));

    expect(screen.getByRole("button", { name: "One-Shot" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByText(
        "One planning conversation writes a single document, implemented in one commit.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "One-Shot planning model: Fable 5.1 · high" }),
    ).toBeInTheDocument();
    for (const stage of ["PRD", "Tech spec", "Plan"]) {
      expect(
        screen.queryByRole("button", { name: `${stage} model: Fable 5.1 · high` }),
      ).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "Structured" }));

    expect(screen.getByRole("button", { name: "PRD model: Fable 5.1 · high" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /One-Shot planning model:/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps an adjustment to a stage both modes have", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: /Models/ }));
    await user.click(
      await screen.findByRole("button", { name: "Implementation model: Opus 5 · high" }),
    );
    await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "One-Shot" }));

    expect(screen.getByRole("button", { name: /Models/ })).toHaveTextContent(
      "Implementation: Opus 5 · xhigh",
    );
    expect(
      screen.getByRole("button", { name: "Implementation model: Opus 5 · xhigh" }),
    ).toBeInTheDocument();
  });

  it("sums up only the stages of the mode", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: /Models/ }));
    await user.click(await screen.findByRole("button", { name: "PRD model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "One-Shot" }));

    expect(screen.getByRole("button", { name: /Models/ })).toHaveTextContent("Defaults");
  });

  it("creates the task in the mode of the dialog", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: "One-Shot" }));
    await user.type(screen.getByLabelText("Name"), "fix-header");
    await user.type(screen.getByLabelText("Initial context"), "The header overlaps the menu");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledWith({
        name: "fix-header",
        repositoryId: "repo-1",
        initialContext: "The header overlaps the menu",
        mode: "one_shot",
        models: makeModelDefaults(),
        reviewMode: "manual",
        card: null,
      });
    });
  });

  it("submits from the context field with Ctrl+Enter", async () => {
    const { user } = open();

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Initial context"), "A login screen");
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledOnce();
    });
  });

  it("keeps the form open with the message when creation fails", async () => {
    vi.mocked(api.createTask).mockRejectedValue(new Error("A task with this name already exists."));
    const { user } = open();

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Initial context"), "A login screen");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("A task with this name already exists.")).toBeVisible();
    expect(useAppStore.getState().newTaskOpen).toBe(true);
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("closes without creating anything on Cancel", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(useAppStore.getState().newTaskOpen).toBe(false);
    expect(api.createTask).not.toHaveBeenCalled();
  });
});
