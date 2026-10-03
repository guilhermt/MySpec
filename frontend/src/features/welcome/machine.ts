import type { MachineItemView } from "@/components/system/MachineChecks";
import type { Machine } from "@/lib/wails";

const SIGN_IN = "gh auth login";

/** machineItems are what This machine lists, in order: Claude Code, then gh missing or signed out; unknown ones left out. */
export function machineItems(machine: Machine): MachineItemView[] {
  const items: MachineItemView[] = [];
  if (machine.claude === "not_found") {
    items.push({
      id: "claude",
      title: "Claude Code was not found",
      text: "Every task, review and discussion runs in it. Install it, or point MYSPEC_CLAUDE_PATH at the executable, then reopen MySpec. You can register boards and repositories meanwhile.",
      command: "",
    });
  }
  if (machine.gh === "not_installed") {
    items.push({
      id: "gh",
      title: "The GitHub CLI isn't installed",
      text: "MySpec reads boards and pull requests through it. Install it and sign in, then add a board.",
      command: SIGN_IN,
    });
  } else if (machine.gh === "signed_out") {
    items.push({
      id: "gh",
      title: "The GitHub CLI isn't signed in",
      text: "Sign in from a terminal, then add a board. Adding a repository works without it.",
      command: SIGN_IN,
    });
  }
  return items;
}
