import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewTaskDialog } from "@/features/task-create/NewTaskDialog";
import { api, type State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, type StoreOptions } from "@/test/render";
import {
  makeArchivedTask,
  makeBoard,
  makeBoardCard,
  makeModelDefaults,
  makeRepository,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const NAME_HELP = "Lowercase letters, digits and hyphens. It names the branch and the worktree.";

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

    open({ tasks: [task] }, { location: { kind: "task", id: task.id } });

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

    await user.click(screen.getByRole("link", { name: 'Use "minha-feature"' }));

    expect(screen.getByLabelText("Name")).toHaveValue("minha-feature");
    expect(screen.getByText(NAME_HELP)).toBeVisible();
  });

  it("refuses a name another task of the repository already has", async () => {
    const { user } = open({ tasks: [makeTask({ name: "add-login" })] });

    await user.type(screen.getByLabelText("Name"), "add-login");

    expect(screen.getByText("A task named add-login already exists in dev/web.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute("aria-disabled", "true");
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

    expect(screen.getByText(NAME_HELP)).toBeVisible();
    expect(screen.queryByText(/already exists in/)).not.toBeInTheDocument();
  });

  it("keeps Create out of reach until both fields are filled", async () => {
    const { user } = open();
    const create = screen.getByRole("button", { name: "Create" });

    expect(create).toHaveAttribute("aria-disabled", "true");

    await user.type(screen.getByLabelText("Name"), "add-login");
    expect(create).toHaveAttribute("aria-disabled", "true");

    await user.type(screen.getByLabelText("Context"), "   ");
    expect(create).toHaveAttribute("aria-disabled", "true");

    await user.type(screen.getByLabelText("Context"), "A login screen");
    expect(create).toHaveAttribute("aria-disabled", "false");
  });

  it("creates the task in the repository that was chosen and opens it", async () => {
    vi.mocked(api.createTask).mockResolvedValue("task-9");
    const { user } = open();

    await user.click(screen.getByRole("button", { name: "Repository: dev/web" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "dev/api" }));
    await user.type(screen.getByLabelText("Name"), "fix-header");
    await user.type(screen.getByLabelText("Context"), "The header overlaps the menu");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-9" });
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
    await user.type(screen.getByLabelText("Context"), "A login screen");
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
    await user.type(screen.getByLabelText("Context"), "A login screen");
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

    expect(screen.getByRole("radio", { name: "Agent" })).toBeChecked();
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

    await user.click(screen.getByRole("radio", { name: "Agent" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Context"), "A login screen");
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

    const modes = screen.getByRole("radiogroup", { name: "Mode" });
    expect(within(modes).getByRole("radio", { name: "Structured" })).toBeChecked();
    expect(within(modes).getByRole("radio", { name: "One-Shot" })).not.toBeChecked();
    expect(
      screen.getByText(
        "A PRD, a tech spec and a plan of steps, each step its own commit. Fixed once the task exists.",
      ),
    ).toBeInTheDocument();
  });

  it("moves Mode and Review mode with the arrow keys", async () => {
    const { user } = open();

    await user.click(screen.getByRole("radio", { name: "Structured" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "One-Shot" })).toBeChecked();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Structured" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Manual" }));
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Agent" })).toBeChecked();
    expect(
      screen.getByText(
        "An agent reviews each step, and the task runs to the pull request on its own.",
      ),
    ).toBeInTheDocument();
  });

  it("names the defaults in the tooltip of an own choice", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: /Models/ }));
    await user.click(await screen.findByRole("button", { name: "PRD model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));
    await user.keyboard("{Escape}");
    await user.hover(screen.getByRole("button", { name: "PRD model: Fable 5.1 · xhigh" }));

    expect((await screen.findAllByText("Defaults: Fable 5.1 · high")).length).toBeGreaterThan(0);
  });

  it("switches the hint and the models to the One-Shot mode", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: /Models/ }));
    await user.click(screen.getByRole("radio", { name: "One-Shot" }));

    expect(screen.getByRole("radio", { name: "One-Shot" })).toBeChecked();
    expect(
      screen.getByText(
        "One planning conversation writes a single document, implemented in one commit. Fixed once the task exists.",
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

    await user.click(screen.getByRole("radio", { name: "Structured" }));

    expect(screen.getByRole("button", { name: "PRD model: Fable 5.1 · high" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /One-Shot planning model:/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps an adjustment to a stage both modes have", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: /Models/ }));
    await user.click(
      await screen.findByRole("button", { name: "Implementation model: Opus 5.5 (1M) · high" }),
    );
    await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("radio", { name: "One-Shot" }));

    expect(screen.getByRole("button", { name: /Models/ })).toHaveTextContent(
      "Implementation: Opus 5.5 (1M) · xhigh",
    );
    expect(
      screen.getByRole("button", { name: "Implementation model: Opus 5.5 (1M) · xhigh" }),
    ).toBeInTheDocument();
  });

  it("sums up only the stages of the mode", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: /Models/ }));
    await user.click(await screen.findByRole("button", { name: "PRD model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("radio", { name: "One-Shot" }));

    expect(screen.getByRole("button", { name: /Models/ })).toHaveTextContent("Defaults");
  });

  it("creates the task in the mode of the dialog", async () => {
    const { user } = open();

    await user.click(screen.getByRole("radio", { name: "One-Shot" }));
    await user.type(screen.getByLabelText("Name"), "fix-header");
    await user.type(screen.getByLabelText("Context"), "The header overlaps the menu");
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
    await user.type(screen.getByLabelText("Context"), "A login screen");
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledOnce();
    });
  });

  it("keeps the form open with the message when creation fails", async () => {
    vi.mocked(api.createTask).mockRejectedValue(new Error("A task with this name already exists."));
    const { user } = open();

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Context"), "A login screen");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("A task with this name already exists.")).toBeVisible();
    expect(useAppStore.getState().newTaskOpen).toBe(true);
    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  it("starts on the name, with the cursor after what a card suggests", async () => {
    const card = makeBoardCard({ readAt: new Date().toISOString() });
    open(
      { boards: [makeBoard({ cards: [card] })] },
      { newTaskCard: { boardId: "board-1", key: "dev/web#12" } },
    );

    const name = screen.getByLabelText("Name");
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveProperty("selectionStart", "12-add-the-login-screen".length);
  });

  it("creates with Enter in the name", async () => {
    const { user } = open();

    await user.type(screen.getByLabelText("Context"), "A login screen");
    await user.type(screen.getByLabelText("Name"), "add-login{Enter}");

    await waitFor(() => {
      expect(api.createTask).toHaveBeenCalledOnce();
    });
  });

  it("closes the list of repositories before the dialog on Esc", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: "Repository: dev/web" }));
    await screen.findByRole("menuitemradio", { name: "dev/api" });
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menuitemradio", { name: "dev/api" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(useAppStore.getState().newTaskOpen).toBe(true);
  });

  it("clones from the item, keeping the menu open and the item unchosen", async () => {
    const bare = makeRepository({
      id: "repo-3",
      name: "infra",
      fullName: "dev/infra",
      cloned: false,
    });
    vi.mocked(api.cloneRepository).mockRejectedValue(new Error("gh: no access"));
    const { user } = open({ repositories: [WEB, bare] });

    await user.click(screen.getByRole("button", { name: "Repository: dev/web" }));
    const item = await screen.findByRole("menuitem", { name: /dev\/infra/ });
    expect(item).toHaveTextContent("Not cloned");
    await user.click(item);

    expect(api.cloneRepository).toHaveBeenCalledWith("repo-3");
    expect(await screen.findAllByText("gh: no access")).toHaveLength(2);
    expect(screen.getByRole("menuitemradio", { name: "dev/web" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Repository: dev/web" })).toBeInTheDocument();
  });

  it("says what is missing next to Create", async () => {
    const { user } = open();

    expect(screen.getByText("Name the task to create it.")).toBeVisible();

    await user.type(screen.getByLabelText("Name"), "Bad Name");
    expect(screen.getByText("Fix the name to create the task.")).toBeVisible();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "add-login");
    expect(screen.getByText("Say what you want to build.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create" })).toHaveAccessibleDescription(
      "Say what you want to build.",
    );

    await user.type(screen.getByLabelText("Context"), "A login screen");
    expect(screen.queryByText("Say what you want to build.")).not.toBeInTheDocument();
  });

  it("holds the fields while the first session starts", async () => {
    vi.mocked(api.createTask).mockReturnValue(new Promise(() => {}));
    const { user } = open();

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Context"), "A login screen");
    await user.click(screen.getByRole("button", { name: "Create" }));

    const creating = await screen.findByRole("button", { name: "Creating…" });
    expect(creating).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Starting the first session…")).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Context")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");

    await user.click(creating);
    expect(api.createTask).toHaveBeenCalledOnce();
  });

  it("says in the footer that the task was undone when the session did not start", async () => {
    vi.mocked(api.createTask).mockRejectedValue(
      new Error("Claude Code didn't start. The task was undone."),
    );
    const { user } = open();

    await user.type(screen.getByLabelText("Name"), "add-login");
    await user.type(screen.getByLabelText("Context"), "A login screen");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Claude Code didn't start. The task was undone.",
    );
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  it("closes without creating anything on Cancel", async () => {
    const { user } = open();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(useAppStore.getState().newTaskOpen).toBe(false);
    expect(api.createTask).not.toHaveBeenCalled();
  });

  describe("from a card", () => {
    const CARD_REF = { boardId: "board-1", key: "dev/web#12" };

    function openCard(card = makeBoardCard(), state: Partial<State> = {}) {
      // A fresh reading: the refresh has tests of its own.
      const fresh = { ...card, readAt: new Date().toISOString() };
      return open({ boards: [makeBoard({ cards: [fresh] })], ...state }, { newTaskCard: CARD_REF });
    }

    it("shows the card and fixes the repository to its own", async () => {
      openCard();

      expect(screen.getByText("Add the login screen")).toBeInTheDocument();
      expect(screen.getByText("dev/web · Todo")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Repository:/ })).not.toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toHaveValue("12-add-the-login-screen");
      expect(screen.getByRole("button", { name: "Show" })).toBeInTheDocument();
      await waitFor(() => {
        expect(api.cardContext).toHaveBeenCalledWith("board-1", "dev/web#12");
      });
    });

    it("says so when the card is not in the last reading", () => {
      open({ boards: [makeBoard()] }, { newTaskCard: CARD_REF });

      expect(
        screen.getByText("◇ This card isn't in the last reading of the board."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    });

    it("refuses a suggested name the repository already has", () => {
      openCard(makeBoardCard(), { tasks: [makeTask({ name: "12-add-the-login-screen" })] });

      expect(
        screen.getByText("A task named 12-add-the-login-screen already exists in dev/web."),
      ).toBeVisible();
      expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });

    it("warns about unsatisfied dependencies without keeping Create out of reach", () => {
      openCard(
        makeBoardCard({
          dependencies: [
            {
              key: "dev/api#3",
              repository: "dev/api",
              number: 3,
              title: "Expose the session endpoint",
              url: "https://github.com/dev/api/issues/3",
              state: "open",
              status: "In progress",
              onBoard: true,
              pullRequests: [
                {
                  repository: "dev/api",
                  number: 8,
                  url: "https://github.com/dev/api/pull/8",
                  state: "open",
                },
              ],
              satisfied: false,
            },
          ],
        }),
      );

      expect(screen.getByText("Depends on dev/api#3")).toBeInTheDocument();
      expect(screen.getByText(/Expose the session endpoint/)).toBeInTheDocument();
      expect(
        screen.getByText(
          "dev/api · Open · In progress · pull request #8 · Open. A warning only: the task can start.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute(
        "aria-disabled",
        "false",
      );
    });

    it("creates the task from the card with what the user added", async () => {
      vi.mocked(api.createTask).mockResolvedValue("task-9");
      const { user } = openCard();

      await user.click(screen.getByRole("button", { name: "Add to it" }));
      await user.type(screen.getByLabelText(/Additional context/), "Start with the form");
      await user.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => {
        expect(useAppStore.getState().location).toEqual({ kind: "task", id: "task-9" });
      });
      expect(api.createTask).toHaveBeenCalledWith({
        name: "12-add-the-login-screen",
        repositoryId: "repo-1",
        initialContext: "Start with the form",
        mode: "structured",
        models: makeModelDefaults(),
        reviewMode: "manual",
        card: CARD_REF,
      });
      expect(useAppStore.getState().newTaskCard).toBeNull();
    });

    it("shows why the card could not become a task", async () => {
      vi.mocked(api.createTask).mockRejectedValue(
        new Error("Card #12 already has an active task: login."),
      );
      const { user } = openCard();

      await user.click(screen.getByRole("button", { name: "Create" }));

      expect(
        await screen.findByText("Card #12 already has an active task: login."),
      ).toBeInTheDocument();
    });
  });
});
