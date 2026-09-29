import type { NameProblem } from "@/lib/task-name";
import { TASK_NAME_MAX } from "@/lib/task-name";
import type { BoardCard } from "@/lib/wails";

// joinParts reads a list the way a sentence does: "a", "a and b", "a, b and c".
function joinParts(parts: readonly string[]): string {
  const last = parts.at(-1);
  if (parts.length < 2 || last === undefined) {
    return parts.join("");
  }
  return `${parts.slice(0, -1).join(", ")} and ${last}`;
}

/** characterCount counts code points: "5,690 characters", "1 character". */
export function characterCount(text: string): string {
  const count = [...text].length;
  return `${count.toLocaleString("en-US")} character${count === 1 ? "" : "s"}`;
}

/**
 * contextLine is "From the card: " and the parts the assembled context has, with
 * the count once the text arrived.
 */
export function contextLine(card: BoardCard, text: string | null): string {
  const siblings = card.siblings?.length ?? 0;
  const dependencies = card.dependencies?.length ?? 0;
  const parts = [`#${card.number}`];
  if (card.epic !== null) {
    parts.push(`the epic ${card.epic.title}`);
  }
  if (siblings > 0) {
    parts.push(`${siblings} card${siblings === 1 ? "" : "s"} of the epic`);
  }
  if (dependencies > 0) {
    parts.push(`${dependencies} ${dependencies === 1 ? "dependency" : "dependencies"}`);
  }
  if (card.writtenBy !== null) {
    parts.push(`the discussion ${card.writtenBy.title}`);
  }
  const line = `From the card: ${joinParts(parts)}`;
  return text === null ? line : `${line} · ${characterCount(text)}`;
}

/** CreateBlock is what keeps Create from acting. */
export type CreateBlock = "no-repository" | "no-name" | "bad-name" | "no-context";

/** CREATE_REASON is what the footer says for each block. */
export const CREATE_REASON: Record<CreateBlock, string> = {
  "no-repository": "Choose a repository to create the task.",
  "no-name": "Name the task to create it.",
  "bad-name": "Fix the name to create the task.",
  "no-context": "Say what you want to build.",
};

/** createBlock is the first block that keeps Create from acting, null when nothing does. */
export function createBlock(input: {
  repositoryId: string;
  problem: NameProblem | null;
  fromCard: boolean;
  context: string;
}): CreateBlock | null {
  if (input.repositoryId === "") {
    return "no-repository";
  }
  if (input.problem === "empty") {
    return "no-name";
  }
  if (input.problem !== null) {
    return "bad-name";
  }
  return !input.fromCard && input.context.trim() === "" ? "no-context" : null;
}

/** nameProblemText is what the name field says of a name that cannot be used. */
export function nameProblemText(problem: NameProblem, name: string, fullName: string): string {
  switch (problem) {
    case "empty":
      return "";
    case "invalid":
      return "Use lowercase letters, digits and single hyphens.";
    case "too_long":
      return `Use at most ${TASK_NAME_MAX} characters.`;
    case "taken":
      return `A task named ${name} already exists in ${fullName}.`;
  }
}
