import { describe, expect, it } from "vitest";
import {
  changedNote,
  choicesOf,
  chosenCloneOf,
  consequence,
  footerSum,
  linkText,
  pluralize,
  premarkHelp,
  stepsOf,
  subtitle,
  withOption,
} from "@/features/boards/board-dialog";
import { makeBoardPreview, makeBoardRepositoryOption, makeRepository } from "@/test/wails-mock";

describe("pluralize", () => {
  it("names one thing in the singular and any other count in the plural", () => {
    expect(pluralize(1, "card")).toBe("1 card");
    expect(pluralize(0, "card")).toBe("0 cards");
    expect(pluralize(3, "repository", "repositories")).toBe("3 repositories");
  });
});

describe("linkText", () => {
  it("says how each repository ties to the app", () => {
    const registered = makeRepository();
    expect(linkText(makeBoardRepositoryOption(), registered)).toBe("Registered · ~/projects/web");
    expect(linkText(makeBoardRepositoryOption({ path: "" }), null)).toBe("Registered · Not cloned");
    expect(
      linkText(
        makeBoardRepositoryOption({
          link: "clone",
          path: "/home/dev/api",
          clones: ["/home/dev/api"],
        }),
        null,
      ),
    ).toBe("Clone found · ~/api");
    expect(
      linkText(
        makeBoardRepositoryOption({ link: "clone", clones: ["/home/dev/a", "/home/dev/b"] }),
        null,
      ),
    ).toBe("Clone found · 2 clones:");
    expect(linkText(makeBoardRepositoryOption({ link: "uncloned", path: "" }), null)).toBe(
      "Registered without a clone",
    );
    expect(
      linkText(makeBoardRepositoryOption({ link: "other_board", otherBoard: "Billing" }), null),
    ).toBe("dev/web belongs to the board Billing.");
  });

  it("says the clone of a registered repository is missing", () => {
    expect(
      linkText(makeBoardRepositoryOption({ path: "" }), makeRepository({ missing: true })),
    ).toBe("Registered · the clone at ~/projects/web is missing");
  });
});

describe("chosenCloneOf", () => {
  it("takes the clone the user picked, then the path found, then the first clone", () => {
    const option = makeBoardRepositoryOption({
      link: "clone",
      path: "/home/dev/a",
      clones: ["/home/dev/a", "/home/dev/b"],
    });

    expect(chosenCloneOf(option, { "dev/web": "/home/dev/b" })).toBe("/home/dev/b");
    expect(chosenCloneOf(option, {})).toBe("/home/dev/a");
    expect(chosenCloneOf({ ...option, path: "" }, {})).toBe("/home/dev/a");
  });
});

describe("choicesOf", () => {
  it("sends the checked repositories a board can take, with the clone only for a found one", () => {
    const options = [
      makeBoardRepositoryOption(),
      makeBoardRepositoryOption({
        name: "api",
        fullName: "dev/api",
        link: "clone",
        path: "/home/dev/api",
        clones: ["/home/dev/api", "/work/api"],
      }),
      makeBoardRepositoryOption({ name: "docs", fullName: "dev/docs", checked: false }),
      makeBoardRepositoryOption({ name: "ops", fullName: "dev/ops", link: "other_board" }),
    ];

    expect(choicesOf(options, { "dev/api": "/work/api" })).toEqual([
      { owner: "dev", name: "web", path: "" },
      { owner: "dev", name: "api", path: "/work/api" },
    ]);
  });
});

describe("withOption", () => {
  it("appends a new repository and replaces one of the same name, ignoring case", () => {
    const web = makeBoardRepositoryOption();
    const api = makeBoardRepositoryOption({ name: "api", fullName: "dev/api" });

    expect(withOption([web], api)).toEqual([web, api]);

    const replaced = makeBoardRepositoryOption({ fullName: "Dev/Web", cards: 0 });
    expect(withOption([web, api], replaced)).toEqual([replaced, api]);
  });
});

describe("stepsOf", () => {
  it.each([
    ["add", null, ["project", "statuses", "repositories"]],
    ["add", true, ["project", "statuses", "repositories"]],
    ["add", false, ["project", "repositories"]],
    ["edit", null, ["statuses", "repositories"]],
    ["edit", true, ["statuses", "repositories"]],
    ["edit", false, ["repositories"]],
  ] as const)("%s with Status %s", (mode, hasStatus, want) => {
    expect(stepsOf(mode, hasStatus)).toEqual(want);
  });
});

describe("subtitle", () => {
  const board = makeBoardPreview({ title: "Data Platform", owner: "acme" });
  const full = stepsOf("add", true);
  const bare = stepsOf("add", false);

  it("names the step of an add, and the board from the second", () => {
    expect(subtitle("add", null, "project", full)).toBe("Step 1 of 3 · The project");
    expect(subtitle("add", board, "project", full)).toBe("Step 1 of 3 · The project");
    expect(subtitle("add", board, "statuses", full)).toBe(
      "Data Platform · acme · Step 2 of 3 · Statuses",
    );
    expect(subtitle("add", board, "repositories", full)).toBe(
      "Data Platform · acme · Step 3 of 3 · Repositories",
    );
    expect(subtitle("add", board, "repositories", bare)).toBe(
      "Data Platform · acme · Step 2 of 2 · Repositories",
    );
  });

  it("names the steps of an edit, and not a lone one", () => {
    const edit = stepsOf("edit", true);
    expect(subtitle("edit", board, "statuses", edit)).toBe(
      "Data Platform · acme · Step 1 of 2 · Statuses",
    );
    expect(subtitle("edit", board, "repositories", edit)).toBe(
      "Data Platform · acme · Step 2 of 2 · Repositories",
    );
    expect(subtitle("edit", board, "repositories", stepsOf("edit", false))).toBe(
      "Data Platform · acme · Repositories",
    );
  });
});

describe("premarkHelp", () => {
  const statuses = [
    { id: "todo", name: "To do", final: false },
    { id: "done", name: "Done", final: true },
    { id: "wont", name: "Won't do", final: true },
  ];

  it("names what was marked, the finals first and the status of new cards after", () => {
    expect(premarkHelp(makeBoardPreview({ statuses, newCardStatus: "todo" }))).toBe(
      "Done, Won't do and To do are marked for you, from their names.",
    );
    expect(premarkHelp(makeBoardPreview({ statuses, newCardStatus: "done" }))).toBe(
      "Done and Won't do are marked for you, from their names.",
    );
    expect(
      premarkHelp(makeBoardPreview({ statuses: statuses.slice(0, 2), newCardStatus: "" })),
    ).toBe("Done is marked for you, from its name.");
    expect(premarkHelp(makeBoardPreview({ statuses: statuses.slice(0, 1) }))).toBe("");
  });
});

describe("changedNote", () => {
  const statuses = [
    { id: "todo", name: "To do", final: false },
    { id: "qa", name: "QA", final: false },
    { id: "staging", name: "Staging", final: false },
  ];

  it("is empty when nothing changed", () => {
    expect(changedNote(makeBoardPreview())).toBe("");
  });

  it("tells what is gone and what is new, then the status of new cards", () => {
    expect(changedNote(makeBoardPreview({ statuses, goneStatuses: ["Archived"] }))).toBe(
      "The board changed since it was saved. Archived is gone from its statuses.",
    );
    expect(
      changedNote(
        makeBoardPreview({ statuses, goneStatuses: [], newStatusIds: ["qa", "staging"] }),
      ),
    ).toBe("The board changed since it was saved. QA and Staging are new, not marked.");
    expect(
      changedNote(
        makeBoardPreview({
          statuses,
          goneStatuses: ["Archived", "Blocked"],
          newStatusIds: ["qa"],
          newCardStatusGone: true,
        }),
      ),
    ).toBe(
      "The board changed since it was saved. Archived and Blocked are gone from its statuses, and QA is new, not marked. New cards now start with no status.",
    );
    expect(changedNote(makeBoardPreview({ statuses, newCardStatusGone: true }))).toBe(
      "The board changed since it was saved. New cards now start with no status.",
    );
  });
});

describe("consequence", () => {
  const moving = makeBoardRepositoryOption({ checked: false, release: "no_board" });

  it("is empty for a repository that stays or isn't the board's own", () => {
    expect(consequence({ ...moving, checked: true }, makeRepository())).toBe("");
    expect(consequence({ ...moving, release: "" }, makeRepository())).toBe("");
  });

  it("says what has to move with a repository that goes to No board", () => {
    expect(consequence(moving, makeRepository())).toBe(
      "Moves to No board: it has a clone. Nothing on disk changes.",
    );
    expect(consequence(moving, makeRepository({ archivedTasks: 3 }))).toBe(
      "Moves to No board: it has a clone and 3 archived tasks. Its tasks keep working. Nothing on disk changes.",
    );
    expect(
      consequence(
        moving,
        makeRepository({
          cloned: false,
          activeTasks: 1,
          archivedTasks: 2,
          activeReviews: 1,
          archivedReviews: 1,
        }),
      ),
    ).toBe(
      "Moves to No board: it has 1 active task, 2 archived tasks and 2 reviews. Its tasks keep working. Its reviews keep working.",
    );
  });

  it("says a repository without a clone, tasks or reviews leaves MySpec", () => {
    expect(consequence({ ...moving, release: "leave" }, null)).toBe(
      "Leaves MySpec: it has no clone, tasks or reviews.",
    );
  });
});

describe("footerSum", () => {
  const options = [
    makeBoardRepositoryOption({ fullName: "acme/docs", checked: false, release: "no_board" }),
    makeBoardRepositoryOption({ fullName: "acme/web", checked: false, release: "no_board" }),
    makeBoardRepositoryOption({ fullName: "acme/billing", checked: false, release: "leave" }),
    makeBoardRepositoryOption({ fullName: "acme/api", checked: true, release: "no_board" }),
    makeBoardRepositoryOption({ fullName: "acme/new", checked: false }),
  ];
  const initially = new Set(["acme/docs", "acme/web", "acme/billing", "acme/api"]);

  it("sums the unchecked ones by destination", () => {
    expect(footerSum(options, initially)).toBe(
      "acme/docs and acme/web move to No board, and acme/billing leaves MySpec.",
    );
    expect(footerSum([options[0] as never, options[2] as never], initially)).toBe(
      "acme/docs moves to No board, and acme/billing leaves MySpec.",
    );
    expect(footerSum([options[2] as never], initially)).toBe("acme/billing leaves MySpec.");
  });

  it("is empty with nothing unchecked", () => {
    expect(footerSum([options[3] as never, options[4] as never], initially)).toBe("");
  });
});
