import { describe, expect, it } from "vitest";
import {
  CLAUDE_ITEMS,
  checkAnnouncement,
  GH_ITEMS,
  itemViews,
  MACHINE_ITEMS,
  machineItem,
  missingItems,
  missingViews,
  navMissingText,
  noticeText,
  versionHint,
} from "@/features/machine/machine";
import type { MachineItemId } from "@/lib/wails";
import { makeMachine, withMachineItems } from "@/test/wails-mock";

const missing = (...ids: MachineItemId[]) =>
  withMachineItems(makeMachine(), Object.fromEntries(ids.map((id) => [id, { result: "missing" }])));

describe("missingViews", () => {
  it("lists nothing for a machine with everything", () => {
    expect(missingViews(makeMachine())).toEqual([]);
  });

  it("words Claude Code not found, and the override when MYSPEC_CLAUDE_PATH is set", () => {
    const [plain] = missingViews(missing("claude_found"));
    expect(plain).toMatchObject({
      result: "missing",
      title: "Claude Code was not found",
      text: "Every task, review and discussion runs in it. Install it, or point MYSPEC_CLAUDE_PATH at the executable. You can register boards and repositories meanwhile.",
      command: "",
    });
    const [override] = missingViews({
      ...missing("claude_found"),
      claudeOverride: "/home/user/bin/claude",
    });
    expect(override?.text).toBe(
      "MYSPEC_CLAUDE_PATH points at ~/bin/claude, which isn't an executable. Point it at Claude Code, or unset it. You can register boards and repositories meanwhile.",
    );
  });

  it("words the login and the version of Claude Code", () => {
    expect(
      missingViews({ ...missing("claude_login", "claude_version"), claudeVersion: "2.0.14" }),
    ).toMatchObject([
      {
        title: "Claude Code isn't logged in",
        text: "Sessions won't start. Run claude in a terminal and log in.",
        command: "claude",
      },
      {
        title: "Claude Code is too old",
        text: "This machine has 2.0.14; MySpec needs 2.1.291 or newer. Sessions may fail until you update it.",
        command: "claude update",
      },
    ]);
  });

  it("words the GitHub CLI not installed and not signed in", () => {
    expect(missingViews(missing("gh_found", "gh_login"))).toMatchObject([
      {
        title: "The GitHub CLI isn't installed",
        text: "Boards, pull requests and publishing cards go through it. Install it and sign in. Adding a repository works without it.",
        command: "gh auth login",
      },
      {
        title: "The GitHub CLI isn't signed in",
        text: "Boards, pull requests and publishing cards go through it. Sign in from a terminal. Adding a repository works without it.",
        command: "gh auth login",
      },
    ]);
  });

  it("words a token GitHub refused, with what gh said", () => {
    const machine = withMachineItems(makeMachine(), {
      gh_login: { result: "missing", reason: "invalid_token", detail: "401 Unauthorized" },
    });
    expect(missingViews(machine)).toMatchObject([
      {
        title: "The GitHub CLI isn't signed in",
        text: "GitHub refused the token it holds, as happens when it expires or is revoked. Sign in again from a terminal.",
        command: "gh auth login",
        detail: "401 Unauthorized",
      },
    ]);
  });

  it.each([
    [
      ["project"],
      "The GitHub CLI lacks the project scope",
      "project reads and writes the boards. Add it from a terminal and authorize in the browser.",
      "gh auth refresh -s project",
    ],
    [
      ["repo"],
      "The GitHub CLI lacks the repo scope",
      "repo reads and writes the repositories, their issues and pull requests. Add it from a terminal and authorize in the browser.",
      "gh auth refresh -s repo",
    ],
    [
      ["project", "repo"],
      "The GitHub CLI lacks the project and repo scopes",
      "project reads and writes the boards. repo reads and writes the repositories, their issues and pull requests. Add them from a terminal and authorize in the browser.",
      "gh auth refresh -s project,repo",
    ],
  ])("words the scopes lacking %j", (lacking, title, text, command) => {
    const machine = { ...missing("gh_scopes"), missingScopes: lacking };
    expect(missingViews(machine)).toMatchObject([{ title, text, command }]);
  });

  it("keeps the order of the check and leaves unchecked items out", () => {
    const machine = withMachineItems(makeMachine(), {
      gh_scopes: { result: "missing" },
      claude_login: { result: "missing" },
      claude_version: { result: "unchecked", reason: "timeout" },
    });
    expect(missingViews(machine).map((view) => view.id)).toEqual(["claude_login", "gh_scopes"]);
    expect(missingItems(machine).map((item) => item.id)).toEqual(["claude_login", "gh_scopes"]);
  });
});

describe("itemViews", () => {
  it("lists every item of a tool, in order, with its result", () => {
    expect(itemViews(makeMachine(), CLAUDE_ITEMS).map((view) => view.id)).toEqual([
      ...CLAUDE_ITEMS,
    ]);
    expect(itemViews(makeMachine(), GH_ITEMS).map((view) => view.id)).toEqual([...GH_ITEMS]);
    expect([...CLAUDE_ITEMS, ...GH_ITEMS]).toEqual([...MACHINE_ITEMS]);
  });

  it("words each item that is ok", () => {
    const machine = { ...makeMachine(), claudePath: "/home/user/.local/bin/claude" };
    expect(itemViews(machine, MACHINE_ITEMS)).toMatchObject([
      { result: "ok", title: "Claude Code is installed", text: "~/.local/bin/claude", command: "" },
      { result: "ok", title: "Claude Code is logged in", text: "" },
      { result: "ok", title: "Claude Code 2.1.291", text: "MySpec needs 2.1.291 or newer." },
      { result: "ok", title: "The GitHub CLI is installed", text: "" },
      { result: "ok", title: "The GitHub CLI is signed in", text: "As octocat." },
      {
        result: "ok",
        title: "The GitHub CLI has the project and repo scopes",
        text: "Its login has gist, project, read:org, repo, workflow.",
      },
    ]);
    expect(itemViews({ ...machine, ghAccount: "" }, ["gh_login"])[0]?.text).toBe("");
  });

  it("words each unchecked item by its title and reason", () => {
    const machine = withMachineItems(makeMachine(), {
      claude_found: { result: "unchecked", reason: "failed", detail: "boom" },
      claude_login: { result: "unchecked", reason: "timeout" },
      claude_version: { result: "unchecked", reason: "unreadable", detail: "nonsense" },
      gh_found: { result: "unchecked", reason: "failed" },
      gh_login: { result: "unchecked", reason: "depends" },
      gh_scopes: { result: "unchecked", reason: "no_scopes" },
    });
    expect(itemViews(machine, MACHINE_ITEMS)).toMatchObject([
      { title: "Couldn't look for Claude Code", text: "The check failed.", detail: "boom" },
      {
        title: "Claude Code's login wasn't checked",
        text: "Claude Code didn't answer in 10 seconds.",
      },
      {
        title: "Claude Code's version wasn't checked",
        text: "MySpec couldn't read what Claude Code answered.",
        detail: "nonsense",
      },
      { title: "Couldn't look for the GitHub CLI", text: "The check failed." },
      {
        title: "The GitHub CLI's login wasn't checked",
        text: "Checked once the GitHub CLI is installed.",
        detail: "",
      },
      {
        title: "The GitHub CLI's scopes weren't checked",
        text: "This login doesn't report its scopes, as a fine-grained token doesn't. MySpec can't tell whether it has project and repo.",
      },
    ]);
  });

  it("words the dependent and failed texts of the other items", () => {
    const depends = { result: "unchecked", reason: "depends" } as const;
    const machine = withMachineItems(makeMachine(), {
      claude_login: depends,
      gh_scopes: depends,
    });
    expect(itemViews(machine, ["claude_login", "gh_scopes"]).map((view) => view.text)).toEqual([
      "Checked once Claude Code is found.",
      "Checked once the GitHub CLI is signed in.",
    ]);
    const failed = withMachineItems(makeMachine(), {
      gh_scopes: { result: "unchecked", reason: "failed" },
      gh_login: { result: "unchecked", reason: "timeout" },
    });
    expect(itemViews(failed, ["gh_scopes", "gh_login"]).map((view) => view.text)).toEqual([
      "GitHub didn't confirm the login, as happens without a network.",
      "The GitHub CLI didn't answer in 10 seconds.",
    ]);
  });
});

describe("machineItem", () => {
  it("is an unchecked item before the first check", () => {
    const machine = makeMachine({ checked: false, items: [] });
    expect(machineItem(machine, "gh_login")).toMatchObject({ id: "gh_login", result: "unchecked" });
    expect(missingViews(machine)).toEqual([]);
  });
});

describe("noticeText", () => {
  it("is null with nothing missing", () => {
    expect(noticeText(makeMachine())).toBeNull();
  });

  it("names the item and its consequence when one is missing", () => {
    expect(noticeText(missing("claude_login"))).toEqual({
      title: "Claude Code isn't logged in",
      text: "Sessions won't start.",
    });
    expect(noticeText(missing("gh_scopes"))?.text).toBe(
      "Reading boards, publishing cards or pull requests may fail.",
    );
  });

  it.each([
    ["claude_found", "Tasks, reviews and discussions can't run."],
    ["claude_version", "Sessions may fail."],
    ["gh_found", "Boards, pull requests and publishing cards don't work."],
    ["gh_login", "Boards, pull requests and publishing cards don't work."],
  ] as const)("says the consequence of %s", (id, text) => {
    expect(noticeText(missing(id))?.text).toBe(text);
  });

  it("counts them when several are missing", () => {
    expect(noticeText(missing("claude_login", "gh_found"))).toEqual({
      title: "2 things on this machine need attention",
      text: "Parts of MySpec won't work until they're fixed.",
    });
  });
});

describe("checkAnnouncement and navMissingText", () => {
  it("announces nothing missing, one lack by its title and several by their number", () => {
    expect(checkAnnouncement(makeMachine())).toBe("Checked this machine: nothing is missing.");
    expect(checkAnnouncement(missing("claude_login"))).toBe(
      "Checked this machine: Claude Code isn't logged in.",
    );
    expect(checkAnnouncement(missing("claude_login", "gh_found", "gh_scopes"))).toBe(
      "Checked this machine: 3 things are missing.",
    );
  });

  it("tells the missing item, or how many, for the nav", () => {
    expect(navMissingText(missing("gh_found"))).toBe("The GitHub CLI isn't installed");
    expect(navMissingText(missing("gh_found", "claude_login"))).toBe(
      "2 things are missing on this machine",
    );
  });
});

describe("versionHint", () => {
  it("hints the update while the version is missing", () => {
    expect(versionHint({ ...missing("claude_version"), claudeVersion: "2.0.14" })).toEqual({
      text: "Claude Code 2.0.14 is older than 2.1.291, the oldest MySpec supports, and is the likely cause. Update it, then check again in Settings › Machine.",
      command: "claude update",
    });
  });

  it("is null with the version ok or unchecked", () => {
    expect(versionHint(makeMachine())).toBeNull();
    expect(
      versionHint(
        withMachineItems(makeMachine(), {
          claude_version: { result: "unchecked", reason: "timeout" },
        }),
      ),
    ).toBeNull();
  });
});
