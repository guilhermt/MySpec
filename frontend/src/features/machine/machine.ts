import type { MachineItemView } from "@/components/system/MachineChecks";
import { displayPath } from "@/lib/paths";
import type { Machine, MachineItem, MachineItemId } from "@/lib/wails";
import { asMachineReason, asMachineResult } from "@/lib/wails";

/** MACHINE_ITEMS are the items of the check, in its order. */
export const MACHINE_ITEMS: readonly MachineItemId[] = [
  "claude_found",
  "claude_login",
  "claude_version",
  "gh_found",
  "gh_login",
  "gh_scopes",
];

/** CLAUDE_ITEMS and GH_ITEMS are the items of each tool, in order. */
export const CLAUDE_ITEMS: readonly MachineItemId[] = [
  "claude_found",
  "claude_login",
  "claude_version",
];
export const GH_ITEMS: readonly MachineItemId[] = ["gh_found", "gh_login", "gh_scopes"];

const SIGN_IN = "gh auth login";
const REQUIRED_SCOPES = ["project", "repo"];
const SCOPE_PHRASES: Record<string, string> = {
  project: "project reads and writes the boards.",
  repo: "repo reads and writes the repositories, their issues and pull requests.",
};
const STAY = "You can register boards and repositories meanwhile.";

/** machineItem is the item with id; an unchecked one when the machine has none, as before the first check. */
export function machineItem(machine: Machine, id: MachineItemId): MachineItem {
  return (
    (machine.items ?? []).find((item) => item.id === id) ?? {
      id,
      result: "unchecked",
      reason: "",
      detail: "",
    }
  );
}

/** missingItems are the missing items, in the order of the check. */
export function missingItems(machine: Machine): MachineItem[] {
  return MACHINE_ITEMS.map((id) => machineItem(machine, id)).filter(
    (item) => asMachineResult(item.result) === "missing",
  );
}

interface Wording {
  title: string;
  text: string;
  command: string;
}

function scopesLacking(machine: Machine): string[] {
  return machine.missingScopes !== null && machine.missingScopes.length > 0
    ? machine.missingScopes
    : REQUIRED_SCOPES;
}

// missingWording is what a missing item says, with what to do.
function missingWording(machine: Machine, item: MachineItem): Wording {
  switch (item.id as MachineItemId) {
    case "claude_found":
      return {
        title: "Claude Code was not found",
        text:
          machine.claudeOverride === ""
            ? `Every task, review and discussion runs in it. Install it, or point MYSPEC_CLAUDE_PATH at the executable. ${STAY}`
            : `MYSPEC_CLAUDE_PATH points at ${displayPath(machine.claudeOverride)}, which isn't an executable. Point it at Claude Code, or unset it. ${STAY}`,
        command: "",
      };
    case "claude_login":
      return {
        title: "Claude Code isn't logged in",
        text: "Sessions won't start. Run claude in a terminal and log in.",
        command: "claude",
      };
    case "claude_version":
      return {
        title: "Claude Code is too old",
        text: `This machine has ${machine.claudeVersion}; MySpec needs ${machine.minVersion} or newer. Sessions may fail until you update it.`,
        command: "claude update",
      };
    case "gh_found":
      return {
        title: "The GitHub CLI isn't installed",
        text: "Boards, pull requests and publishing cards go through it. Install it and sign in. Adding a repository works without it.",
        command: SIGN_IN,
      };
    case "gh_login":
      return {
        title: "The GitHub CLI isn't signed in",
        text:
          asMachineReason(item.reason) === "invalid_token"
            ? "GitHub refused the token it holds, as happens when it expires or is revoked. Sign in again from a terminal."
            : "Boards, pull requests and publishing cards go through it. Sign in from a terminal. Adding a repository works without it.",
        command: SIGN_IN,
      };
    case "gh_scopes": {
      const lacking = scopesLacking(machine);
      const names = lacking.join(" and ");
      return {
        title: `The GitHub CLI lacks the ${names} ${lacking.length === 1 ? "scope" : "scopes"}`,
        text: `${lacking.map((scope) => SCOPE_PHRASES[scope] ?? "").join(" ")} Add ${lacking.length === 1 ? "it" : "them"} from a terminal and authorize in the browser.`,
        command: `gh auth refresh -s ${lacking.join(",")}`,
      };
    }
  }
}

function okWording(machine: Machine, id: MachineItemId): Wording {
  switch (id) {
    case "claude_found":
      return {
        title: "Claude Code is installed",
        text: displayPath(machine.claudePath),
        command: "",
      };
    case "claude_login":
      return { title: "Claude Code is logged in", text: "", command: "" };
    case "claude_version":
      return {
        title: `Claude Code ${machine.claudeVersion}`,
        text: `MySpec needs ${machine.minVersion} or newer.`,
        command: "",
      };
    case "gh_found":
      return { title: "The GitHub CLI is installed", text: "", command: "" };
    case "gh_login":
      return {
        title: "The GitHub CLI is signed in",
        text: machine.ghAccount === "" ? "" : `As ${machine.ghAccount}.`,
        command: "",
      };
    case "gh_scopes":
      return {
        title: "The GitHub CLI has the project and repo scopes",
        text: `Its login has ${(machine.ghScopes ?? []).join(", ")}.`,
        command: "",
      };
  }
}

const UNCHECKED_TITLES: Record<MachineItemId, string> = {
  claude_found: "Couldn't look for Claude Code",
  claude_login: "Claude Code's login wasn't checked",
  claude_version: "Claude Code's version wasn't checked",
  gh_found: "Couldn't look for the GitHub CLI",
  gh_login: "The GitHub CLI's login wasn't checked",
  gh_scopes: "The GitHub CLI's scopes weren't checked",
};

function uncheckedText(item: MachineItem): string {
  const id = item.id as MachineItemId;
  const claude = id.startsWith("claude_");
  const tool = claude ? "Claude Code" : "the GitHub CLI";
  const capitalized = claude ? "Claude Code" : "The GitHub CLI";
  switch (asMachineReason(item.reason)) {
    case "depends":
      if (claude) {
        return "Checked once Claude Code is found.";
      }
      return id === "gh_login"
        ? "Checked once the GitHub CLI is installed."
        : "Checked once the GitHub CLI is signed in.";
    case "timeout":
      return `${capitalized} didn't answer in 10 seconds.`;
    case "unreadable":
      return `MySpec couldn't read what ${tool} answered.`;
    case "no_scopes":
      return "This login doesn't report its scopes, as a fine-grained token doesn't. MySpec can't tell whether it has project and repo.";
    case "failed":
      return id === "gh_scopes"
        ? "GitHub didn't confirm the login, as happens without a network."
        : "The check failed.";
    default:
      return "";
  }
}

// viewOf is the item as the list draws it.
function viewOf(machine: Machine, item: MachineItem): MachineItemView {
  const result = asMachineResult(item.result);
  const id = item.id as MachineItemId;
  if (result === "missing") {
    const wording = missingWording(machine, item);
    return {
      id,
      result,
      ...wording,
      detail: asMachineReason(item.reason) === "invalid_token" ? item.detail : "",
    };
  }
  if (result === "ok") {
    return { id, result, ...okWording(machine, id), detail: "" };
  }
  const reason = asMachineReason(item.reason);
  return {
    id,
    result,
    title: UNCHECKED_TITLES[id],
    text: uncheckedText(item),
    command: "",
    detail: reason === "depends" ? "" : item.detail,
  };
}

/** missingViews are what This machine lists: one view per missing item, in order, each with what to do. */
export function missingViews(machine: Machine): MachineItemView[] {
  return missingItems(machine).map((item) => viewOf(machine, item));
}

/** itemViews are what Settings › Machine lists of a tool: every item, with its result. */
export function itemViews(machine: Machine, ids: readonly MachineItemId[]): MachineItemView[] {
  return ids.map((id) => viewOf(machine, machineItem(machine, id)));
}

const CONSEQUENCES: Record<MachineItemId, string> = {
  claude_found: "Tasks, reviews and discussions can't run.",
  claude_login: "Sessions won't start.",
  claude_version: "Sessions may fail.",
  gh_found: "Boards, pull requests and publishing cards don't work.",
  gh_login: "Boards, pull requests and publishing cards don't work.",
  gh_scopes: "Reading boards, publishing cards or pull requests may fail.",
};

/** noticeText is the notice at the top: the missing item, or how many; null with nothing missing. */
export function noticeText(machine: Machine): { title: string; text: string } | null {
  const missing = missingItems(machine);
  const [first] = missing;
  if (first === undefined) {
    return null;
  }
  if (missing.length === 1) {
    return {
      title: missingWording(machine, first).title,
      text: CONSEQUENCES[first.id as MachineItemId],
    };
  }
  return {
    title: `${missing.length} things on this machine need attention`,
    text: "Parts of MySpec won't work until they're fixed.",
  };
}

/** checkAnnouncement is what the live region says after Check again. */
export function checkAnnouncement(machine: Machine): string {
  const missing = missingItems(machine);
  const [first] = missing;
  if (first === undefined) {
    return "Checked this machine: nothing is missing.";
  }
  if (missing.length === 1) {
    return `Checked this machine: ${missingWording(machine, first).title}.`;
  }
  return `Checked this machine: ${missing.length} things are missing.`;
}

/** navMissingText is the tooltip and the description of ◇ N on Machine: the missing item, or how many. */
export function navMissingText(machine: Machine): string {
  const missing = missingItems(machine);
  const [first] = missing;
  if (first !== undefined && missing.length === 1) {
    return missingWording(machine, first).title;
  }
  return `${missing.length} things are missing on this machine`;
}

/** versionHint is what a failed session adds while Claude Code is too old; null otherwise. */
export function versionHint(machine: Machine): { text: string; command: string } | null {
  if (asMachineResult(machineItem(machine, "claude_version").result) !== "missing") {
    return null;
  }
  return {
    text: `Claude Code ${machine.claudeVersion} is older than ${machine.minVersion}, the oldest MySpec supports, and is the likely cause. Update it, then check again in Settings › Machine.`,
    command: "claude update",
  };
}
