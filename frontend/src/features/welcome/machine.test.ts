import { describe, expect, it } from "vitest";
import { machineItems } from "@/features/welcome/machine";
import { makeMachine } from "@/test/wails-mock";

describe("machineItems", () => {
  it.each([
    ["everything found", { claude: "found", gh: "ready" }, []],
    ["nothing known", { claude: "unknown", gh: "unknown" }, []],
    ["Claude Code not found", { claude: "not_found" }, ["claude"]],
    ["gh not installed", { gh: "not_installed" }, ["gh"]],
    ["gh signed out", { gh: "signed_out" }, ["gh"]],
    [
      "both missing, Claude Code first",
      { claude: "not_found", gh: "signed_out" },
      ["claude", "gh"],
    ],
  ])("lists %s", (_name, machine, ids) => {
    expect(machineItems(makeMachine(machine)).map((item) => item.id)).toEqual(ids);
  });

  it("says what each lacks, with the command that signs in", () => {
    expect(machineItems(makeMachine({ claude: "not_found" }))).toEqual([
      {
        id: "claude",
        title: "Claude Code was not found",
        text: "Every task, review and discussion runs in it. Install it, or point MYSPEC_CLAUDE_PATH at the executable, then reopen MySpec. You can register boards and repositories meanwhile.",
        command: "",
      },
    ]);
    expect(machineItems(makeMachine({ gh: "not_installed" }))).toEqual([
      {
        id: "gh",
        title: "The GitHub CLI isn't installed",
        text: "MySpec reads boards and pull requests through it. Install it and sign in, then add a board.",
        command: "gh auth login",
      },
    ]);
    expect(machineItems(makeMachine({ gh: "signed_out" }))).toEqual([
      {
        id: "gh",
        title: "The GitHub CLI isn't signed in",
        text: "Sign in from a terminal, then add a board. Adding a repository works without it.",
        command: "gh auth login",
      },
    ]);
  });
});
