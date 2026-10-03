import { act, screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/app/AppShell";
import { MigrationRefused } from "@/features/migration/MigrationRefused";
import { SettingsView } from "@/features/settings/SettingsView";
import { StartScreen } from "@/features/startup/StartScreen";
import type { Repository } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  fixSettingsSceneClock,
  migrationScene,
  SETTINGS_SCENES,
  SETTINGS_VARIATIONS,
  type SettingsSceneName,
  type SettingsSceneSetup,
  START_VARIATIONS,
  settingsScene,
  startScene,
  WELCOME_VARIATIONS,
  welcomeScene,
} from "@/test/settings-scenes";
import { api } from "@/test/wails-mock";

fixSettingsSceneClock();

/** Screen is what a scene draws. */
type Screen = "settings" | "welcome" | "migration";

/** Row is a control of the screens that left, in a state it appeared in, and where it is now. */
interface Row {
  /** control is the name it had, and where. */
  control: string;
  scene: SettingsSceneName;
  variation?: string;
  /** steps is what the user does before the new place shows. */
  steps?: (user: UserEvent) => Promise<void>;
  role: Parameters<typeof screen.getByRole>[0];
  /** name is the whole accessible name of the new place. */
  name: string | RegExp;
  /** checked is the state of a box or a radio the new place has. */
  checked?: boolean;
  /** text is what the new place says, for a place that has no name of its own. */
  text?: string | RegExp;
  /** description is what a screen reader reads after the name, for a refusal under a field. */
  description?: string | RegExp;
}

const click =
  (role: Parameters<typeof screen.getByRole>[0], name: string | RegExp) =>
  async (user: UserEvent) => {
    await user.click(await screen.findByRole(role, { name }));
  };

/** after chains steps. */
const then =
  (...steps: ((user: UserEvent) => Promise<void>)[]) =>
  async (user: UserEvent) => {
    for (const step of steps) {
      await step(user);
    }
  };

const moreFor = (fullName: string) => click("button", `More for ${fullName}`);

/** withRepository is the state of the page Repositories arriving with one repository changed, as the Go sends it. */
const withRepository = (fullName: string, change: Partial<Repository>) => async () => {
  const { state } = settingsScene("settings-repos", "");
  act(() => {
    useAppStore.getState().applyState({
      ...state,
      repositories: (state.repositories ?? []).map((repository) =>
        repository.fullName === fullName ? { ...repository, ...change } : repository,
      ),
    });
  });
};

// ---------------- The settings ----------------

const SETTINGS_ROWS: Row[] = [
  // The place.
  { control: "Close (Settings)", scene: "settings-defaults", role: "button", name: /^Close/ },
  ...(["Defaults", "Boards", "Repositories", "Prompts"] as const).map(
    (name): Row => ({
      control: `${name} (navigation)`,
      scene: "settings-defaults",
      role: "link",
      name: new RegExp(`^${name}`),
    }),
  ),
  ...[
    "PRD",
    "Tech spec",
    "Plan",
    "One-Shot planning",
    "Step review",
    "Commit",
    "PR",
    "PR review",
    "Discussion",
  ].map(
    (name): Row => ({
      control: `the prompt ${name} (navigation)`,
      scene: "settings-prompts",
      role: "link",
      name: new RegExp(`^${name}`),
    }),
  ),

  // Defaults.
  {
    control: "the review mode, Manual",
    scene: "settings-defaults",
    role: "radio",
    name: /^Manual/,
    checked: false,
  },
  {
    control: "the review mode, Agent",
    scene: "settings-defaults",
    role: "radio",
    name: /^Agent/,
    checked: true,
  },
  ...[
    "PRD",
    "Tech spec",
    "Plan",
    "One-Shot planning",
    "Implementation",
    "Step review",
    "PR",
    "PR review",
    "Discussion",
  ].map(
    (name): Row => ({
      control: `the model of ${name}`,
      scene: "settings-defaults",
      role: "button",
      name: new RegExp(`^${name}: `),
    }),
  ),

  // The page Boards.
  { control: "Add board", scene: "settings-boards", role: "button", name: "Add board" },
  { control: "Edit", scene: "settings-boards", role: "button", name: "Edit Platform Roadmap" },
  { control: "Remove", scene: "settings-boards", role: "button", name: "Remove Platform Roadmap" },
  {
    control: "the link of the project on GitHub",
    scene: "settings-boards",
    role: "link",
    name: /^acme\/projects\/7/,
  },
  {
    control: "the owner, the type and the repositories",
    scene: "settings-boards",
    role: "listitem",
    name: /^Platform Roadmap, acme, 6 repositories/,
    text: /Organization · 6 repositories: api, billing/,
  },
  {
    control: "the statuses",
    scene: "settings-boards",
    role: "listitem",
    name: /^Platform Roadmap/,
    text: "Final: Done, Won't do, Duplicate",
  },
  {
    control: "the reading",
    scene: "settings-boards",
    role: "listitem",
    name: /^Platform Roadmap/,
    text: "Read 2m ago",
  },
  {
    control: "the failure of the reading, with Try again",
    scene: "settings-boards",
    role: "button",
    name: /^Try again/,
  },

  // The dialog of a board.
  {
    control: "the URL of the project",
    scene: "settings-boards",
    variation: "add-1",
    role: "textbox",
    name: "URL of the GitHub project",
  },
  {
    control: "the refusal under the URL",
    scene: "settings-boards",
    variation: "add-1-error",
    role: "textbox",
    name: "URL of the GitHub project",
    description: /The board doesn't exist/,
  },
  {
    control: "the final statuses",
    scene: "settings-boards",
    variation: "add-2",
    role: "checkbox",
    name: "Done ends the work",
  },
  {
    control: "the status of new cards",
    scene: "settings-boards",
    variation: "add-2",
    role: "radio",
    name: "New cards start in To do",
  },
  {
    control: "the repositories with the clone chosen",
    scene: "settings-boards",
    variation: "add-3",
    role: "button",
    name: "Clone of acme/warehouse: ~/code/warehouse",
  },
  {
    control: "Add owner/name",
    scene: "settings-boards",
    variation: "add-3",
    role: "button",
    name: "Add",
  },
  {
    control: "the refusal of Add owner/name",
    scene: "settings-boards",
    variation: "add-3",
    steps: then(async (user) => {
      api.checkBoardRepository.mockRejectedValue(
        new Error("acme/nope doesn't exist or this account can't read it."),
      );
      // The step takes the focus to its first field a frame after it opens: typing before that
      // would lose the keys to it.
      await waitFor(() =>
        expect(document.activeElement?.closest("[data-dialog-body]")).not.toBeNull(),
      );
      await user.type(
        await screen.findByRole("textbox", { name: "Add a repository" }),
        "acme/nope",
      );
      await user.click(screen.getByRole("button", { name: "Add" }));
      await screen.findByText("acme/nope doesn't exist or this account can't read it.");
    }),
    role: "textbox",
    name: "Add a repository",
    description: "acme/nope doesn't exist or this account can't read it.",
  },
  {
    control: "the error when it saves",
    scene: "settings-boards",
    variation: "add-3",
    steps: then(async (user) => {
      api.addBoard.mockRejectedValue(new Error("database is locked"));
      await user.click(await screen.findByRole("button", { name: /^Add board/ }));
      await screen.findByRole("alert");
    }),
    role: "alert",
    name: "",
    text: "database is locked",
  },
  {
    control: "the preview of Remove board",
    scene: "settings-boards",
    variation: "remove",
    role: "alertdialog",
    name: "Remove Platform Roadmap?",
    text: /5 repositories move to No board and 1 leaves MySpec\./,
  },

  // The page Repositories.
  { control: "Add repository", scene: "settings-repos", role: "button", name: "Add repository" },
  {
    control: "Clone folder, Choose…",
    scene: "settings-repos",
    role: "button",
    name: /^Choose…/,
  },
  { control: "Clone", scene: "settings-repos", role: "button", name: /^Clone/ },
  { control: "Change path", scene: "settings-repos", role: "button", name: "Change path…" },
  {
    control: "Change path, in the ⋯",
    scene: "settings-repos",
    steps: moreFor("acme/api"),
    role: "menuitem",
    name: "Change path…",
  },
  {
    control: "the clone that runs",
    scene: "settings-repos",
    steps: withRepository("acme/billing", { cloning: true }),
    role: "listitem",
    name: /^acme\/billing/,
    text: /Cloning…/,
  },
  {
    control: "the clone that failed, with Try again",
    scene: "settings-repos",
    steps: withRepository("acme/billing", {
      cloneError:
        "fatal: unable to access 'https://github.com/acme/billing/': Could not resolve host",
    }),
    role: "listitem",
    name: /^acme\/billing/,
    text: /Could not resolve host\s*Try again/,
  },
  {
    control: "Remove, with its reason",
    scene: "settings-repos",
    steps: moreFor("acme/web"),
    role: "menuitem",
    name: /^Remove…/,
    text: /archived tasks and \d+ reviews: delete them first\./,
  },
  {
    control: "Remove",
    scene: "settings-repos",
    steps: moreFor("acme/docs"),
    role: "menuitem",
    name: "Remove…",
  },
  {
    control: "the review instructions, Save",
    scene: "settings-repos",
    variation: "instructions",
    role: "button",
    name: /^Save/,
  },
  {
    control: "the review instructions, Cancel",
    scene: "settings-repos",
    variation: "instructions",
    role: "button",
    name: "Cancel",
  },
  {
    control: "the counts",
    scene: "settings-repos",
    role: "listitem",
    name: /^acme\/web, ~\/code\/web, /,
    text: /\d+ archived · \d+ reviews/,
  },
  {
    control: "the board",
    scene: "settings-repos",
    role: "heading",
    name: "Platform Roadmap",
  },
  {
    control: "the path",
    scene: "settings-repos",
    role: "listitem",
    name: /^acme\/api/,
    text: "~/code/api",
  },
  {
    control: "the failure of a change of path",
    scene: "settings-repos",
    variation: "change-path",
    role: "alert",
    name: "",
    text: /is a clone of acme\/terraform, not of acme\/infra/,
  },
  {
    control: "the missing clone",
    scene: "settings-repos",
    role: "listitem",
    name: /^acme\/infra/,
    text: /The clone is missing/,
  },

  // Add repository.
  {
    control: "the filter",
    scene: "settings-repos",
    variation: "add",
    role: "searchbox",
    name: "Filter by name or path",
  },
  {
    control: "the boxes",
    scene: "settings-repos",
    variation: "add",
    role: "checkbox",
    name: /^acme\/billing/,
    checked: false,
  },
  {
    control: "Browse…",
    scene: "settings-repos",
    variation: "add",
    role: "button",
    name: /^Browse…/,
  },
  {
    control: "Add N repositories",
    scene: "settings-repos",
    variation: "add",
    steps: click("checkbox", /^acme\/billing/),
    role: "button",
    name: "Add repository",
  },
  {
    control: "the scan, waiting",
    scene: "settings-repos",
    variation: "add-scanning",
    role: "status",
    name: "",
    text: "Scanning your home folder…",
  },
  {
    control: "the failure of the scan, with Try again",
    scene: "settings-repos",
    steps: then(async (user) => {
      api.scanRepositories.mockRejectedValue(new Error("permission denied"));
      await user.click(await screen.findByRole("button", { name: "Add repository" }));
    }),
    role: "dialog",
    name: "Add repository",
    text: /Couldn't scan your home folder: permission denied\s*Try again/,
  },
  {
    control: "the refusal of a row",
    scene: "settings-repos",
    variation: "add-failed",
    role: "alert",
    name: "",
    text: /is a clone of acme\/site, not of acme\/marketing-site/,
  },
  {
    control: "the refusal of Browse…",
    scene: "settings-repos",
    variation: "add-refused",
    role: "alert",
    name: "",
    text: /is not the root of a git repository/,
  },

  // Remove repository.
  {
    control: "the confirmation of Remove repository",
    scene: "settings-repos",
    variation: "remove",
    role: "button",
    name: "Remove repository",
  },

  // Prompts.
  {
    control: "Edit",
    scene: "settings-prompts",
    variation: "view",
    role: "button",
    name: "Edit",
  },
  {
    control: "Restore default, now Reset to default…",
    scene: "settings-prompts",
    variation: "view",
    role: "button",
    name: "Reset to default…",
  },
  {
    control: "Save",
    scene: "settings-prompts",
    variation: "edit",
    role: "button",
    name: /^Save/,
  },
  {
    control: "Cancel",
    scene: "settings-prompts",
    variation: "edit",
    role: "button",
    name: "Cancel",
  },
  {
    control: "the failure of Save",
    scene: "settings-prompts",
    variation: "edit",
    steps: then(async (user) => {
      api.savePrompt.mockRejectedValue(new Error("database is locked"));
      await user.type(await screen.findByRole("textbox", { name: "PRD prompt" }), "!");
      await user.click(screen.getByRole("button", { name: /^Save/ }));
      await screen.findByRole("alert");
    }),
    role: "alert",
    name: "",
    text: "Couldn't save the prompt: database is locked",
  },
  {
    control: "the column of placeholders",
    scene: "settings-prompts",
    variation: "edit",
    role: "complementary",
    name: "Placeholders",
  },
  {
    control: "Modified, now Edited",
    scene: "settings-prompts",
    role: "link",
    name: /^PRD/,
    text: "Edited Sep 20",
  },
  {
    control: "the failure of the reading",
    scene: "settings-prompts",
    variation: "view-failed",
    role: "button",
    name: "Try again",
  },
];

// ---------------------------------------------------------------------------

async function draw(setup: SettingsSceneSetup, kind: Screen = "settings") {
  for (const [key, value] of Object.entries(setup.storage)) {
    localStorage.setItem(key, value);
  }
  const { listings, prompt } = setup;
  if (listings instanceof Error) {
    api.listPrompts.mockRejectedValue(listings);
  } else if (listings !== undefined) {
    api.listPrompts.mockResolvedValue(listings);
  }
  if (prompt instanceof Error) {
    api.getPrompt.mockRejectedValue(prompt);
  } else if (prompt !== undefined) {
    api.getPrompt.mockResolvedValue(prompt);
  }
  if (setup.machine !== undefined) {
    api.checkMachine.mockResolvedValue(setup.machine);
  }
  const migration = setup.state.migration;
  const element =
    kind === "settings" ? (
      <SettingsView />
    ) : kind === "welcome" ? (
      <AppShell />
    ) : migration !== null ? (
      <MigrationRefused migration={migration} />
    ) : (
      <div />
    );
  const { user } = renderWithStore(element, {
    state: setup.state,
    startup: setup.startup ?? null,
    ui: { location: setup.location },
  });
  await setup.after?.(user);
  return user;
}

describe("where the actions of Settings went", () => {
  it.each(SETTINGS_ROWS)("$control is now $role $name, in $scene $variation", async (row) => {
    const user = await draw(settingsScene(row.scene, row.variation ?? ""));
    await row.steps?.(user);

    const found = await screen.findAllByRole(row.role, {
      name: row.name,
      ...(row.checked === undefined ? {} : { checked: row.checked }),
    });
    expect(found.length).toBeGreaterThan(0);
    if (row.text !== undefined) {
      expect(found[0]).toHaveTextContent(row.text);
    }
    if (row.description !== undefined) {
      expect(found[0]).toHaveAccessibleDescription(row.description);
    }
  });
});

describe("where the text of a prompt went", () => {
  it("renders the text of the prompt as Markdown", async () => {
    await draw(settingsScene("settings-prompts", "view"));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# PRD of");
  });
});

describe("where the actions of the welcome and the migration went", () => {
  it.each(["Add board", "Add repository"])("keeps %s on the welcome", async (name) => {
    await draw(welcomeScene(""), "welcome");

    expect(await screen.findByRole("button", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
  });

  it.each([
    ["Tasks at the root of a workspace", "billing-export"],
    ["Repositories without an origin on GitHub", "portal-sso"],
    ["Tasks with the same name in the same repository", "rate-limit"],
  ])("lists the case %s with its tasks", async (title, task) => {
    await draw(migrationScene(), "migration");

    const region = screen.getByRole("region", { name: title });
    expect(within(region).getAllByText(task).length).toBeGreaterThan(0);
  });

  it("opens the app on Settings and History from the welcome", async () => {
    await draw(welcomeScene("history"), "welcome");

    expect(await screen.findByRole("button", { name: /^Settings/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^History/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

// ---------------------------------------------------------------------------

/** primaries are the primary buttons the top layer shows: the dialog when one is open, else the page. */
function primaries(): Element[] {
  const layer = document.querySelector("[role='dialog'], [role='alertdialog']") ?? document.body;
  return [...layer.querySelectorAll('[data-variant="primary"]')];
}

describe("the one primary of each scene", () => {
  const CASES = SETTINGS_SCENES.flatMap((name) =>
    SETTINGS_VARIATIONS[name].map((variation) => [name, variation] as const),
  );

  it.each(CASES)("has at most one primary in %s %s", async (name, variation) => {
    await draw(settingsScene(name, variation));
    await waitFor(() => expect(document.body).not.toBeEmptyDOMElement());

    expect(primaries().length).toBeLessThanOrEqual(1);
  });

  // A page of Settings has no primary (10:373): its actions sit among the rows, and a block open
  // on the page, as the review instructions, keeps its Save secondary.
  const PAGES: (readonly [SettingsSceneName, string])[] = [
    ...SETTINGS_VARIATIONS["settings-defaults"].map(
      (variation) => ["settings-defaults", variation] as const,
    ),
    ["settings-boards", ""],
    ["settings-boards", "empty"],
    ["settings-repos", ""],
    ["settings-repos", "instructions"],
    ["settings-repos", "menu"],
    ["settings-repos", "change-path"],
    ["settings-repos", "empty"],
    ["settings-prompts", ""],
    ["settings-prompts", "view"],
    ["settings-prompts", "list-failed"],
    ["settings-prompts", "view-failed"],
  ];

  it.each(PAGES)("has no primary on the page in %s %s", async (name, variation) => {
    await draw(settingsScene(name, variation));
    await screen.findByRole("heading", { level: 2 });

    expect(document.querySelector("[role='dialog'], [role='alertdialog']")).toBeNull();
    expect(primaries()).toHaveLength(0);
  });

  it("makes Save the primary of the edit of a prompt, with Ctrl S", async () => {
    await draw(settingsScene("settings-prompts", "edit"));
    const save = await screen.findByRole("button", { name: /^Save/ });

    expect(primaries()).toEqual([save]);
    expect(save).toHaveTextContent("Ctrl S");
  });

  it.each(WELCOME_VARIATIONS)("has no primary in the welcome %s", async (variation) => {
    await draw(welcomeScene(variation), "welcome");
    await screen.findByRole("heading", { level: 1, name: "Welcome to MySpec" });

    expect(primaries()).toHaveLength(0);
  });

  it("has no primary in the migration", async () => {
    await draw(migrationScene(), "migration");

    expect(primaries()).toHaveLength(0);
  });

  it.each(START_VARIATIONS)(
    "has a primary in the start %s only when it failed",
    async (variation) => {
      renderWithStore(<StartScreen />, { startup: startScene(variation).startup ?? null });
      const failed = variation === "failed" || variation === "disk-full";

      expect(primaries()).toHaveLength(failed ? 1 : 0);
    },
  );
});
