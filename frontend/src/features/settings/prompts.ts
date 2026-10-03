import type { PromptStage } from "@/lib/wails";

export interface PromptMeta {
  stage: PromptStage;
  name: string;
  description: string;
}

/** PROMPTS are the prompts the settings show, in workflow order, with what each one is for. */
export const PROMPTS: readonly PromptMeta[] = [
  { stage: "prd", name: "PRD", description: "Opens the PRD session of a task." },
  { stage: "tech_spec", name: "Tech spec", description: "Opens the tech spec session." },
  {
    stage: "plan",
    name: "Plan",
    description:
      "Opens the plan session. Holds the template of the step files, which are the prompts of the implementation.",
  },
  {
    stage: "one_shot",
    name: "One-Shot planning",
    description:
      "Opens the planning session of a One-Shot task. Holds the structure of the One-Shot document, which is the prompt of its implementation.",
  },
  {
    stage: "step_review",
    name: "Step review",
    description: "Opens the review session of a step in Agent mode.",
  },
  {
    stage: "commit",
    name: "Commit",
    description:
      "Sent after a step is approved, by you or by the agent review, and after you approve the changes of a PR review.",
  },
  { stage: "pr", name: "PR", description: "Opens the pull request session of the task." },
  {
    stage: "pr_review",
    name: "PR review",
    description: "Opens the review session of the pull request.",
  },
  {
    stage: "discussion",
    name: "Discussion",
    description:
      "Opens the conversation of a discussion, which writes the document and the drafts of cards.",
  },
];

/** promptMeta is the name and the description of a prompt. */
export function promptMeta(stage: PromptStage): PromptMeta {
  return (
    PROMPTS.find((prompt) => prompt.stage === stage) ?? { stage, name: stage, description: "" }
  );
}

export interface PlaceholderMeta {
  /** meaning is what the placeholder becomes. */
  meaning: string;
  /** whenRemoved is what the app does when a prompt no longer has it, for the ones it never drops. */
  whenRemoved?: string;
}

/** PLACEHOLDERS say what every placeholder a prompt may carry becomes. */
export const PLACEHOLDERS: Readonly<Record<string, PlaceholderMeta>> = {
  "{{task_name}}": { meaning: "The name of the task" },
  "{{artifacts_dir}}": { meaning: "The artifacts folder of the task" },
  "{{prd_path}}": { meaning: "The PRD file" },
  "{{tech_spec_path}}": { meaning: "The tech spec file" },
  "{{steps_dir}}": { meaning: "The folder of the step files" },
  "{{step_path}}": { meaning: "The file of the step under review" },
  "{{one_shot_path}}": { meaning: "The One-Shot document file" },
  "{{initial_context}}": {
    meaning: "The initial context written when the task was created",
    whenRemoved: "Without it, the initial context is added at the end.",
  },
  "{{repository}}": { meaning: "The repository of the session" },
  "{{branch}}": { meaning: "The branch of the task" },
  "{{base_branch}}": { meaning: "The base branch of the worktree and the pull request" },
  "{{draft_path}}": { meaning: "The file the agent writes the pull request draft to" },
  "{{review_path}}": { meaning: "The file the agent writes the review report to" },
  "{{document_path}}": {
    meaning: "The file the agent writes the document of the discussion to",
  },
  "{{drafts_path}}": { meaning: "The file the agent writes the drafts of cards to" },
  "{{pr_number}}": { meaning: "The number of the pull request" },
  "{{pr_url}}": { meaning: "The address of the pull request" },
  "{{what_to_commit}}": {
    meaning:
      "What the commit takes: what is staged, or every change of the worktree after an agent review",
    whenRemoved: "Without it, the instruction is added at the end.",
  },
  "{{push}}": {
    meaning:
      "The instruction to push the commit when it goes to an open pull request; empty otherwise",
    whenRemoved: "Without it, the instruction is added at the end when it applies.",
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const EDITED_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const EDITED_DAY_OF_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** editedLabel is "Edited today", "Edited yesterday", "Edited Sep 20", "Edited Sep 20, 2025". */
export function editedLabel(editedAt: string, now: number): string {
  const date = new Date(editedAt);
  const today = new Date(now);
  const dayStart = (day: Date) =>
    new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  switch (Math.round((dayStart(today) - dayStart(date)) / DAY_MS)) {
    case 0:
      return "Edited today";
    case 1:
      return "Edited yesterday";
    default:
      return date.getFullYear() === today.getFullYear()
        ? `Edited ${EDITED_DAY.format(date)}`
        : `Edited ${EDITED_DAY_OF_YEAR.format(date)}`;
  }
}

/**
 * linesText is "Your version has 92 lines; the default of this version has 87.", or, with as many
 * lines, "Your version and the default of this version both have 87 lines."
 */
export function linesText(lines: number, defaultLines: number): string {
  const count = (n: number) => `${n} ${n === 1 ? "line" : "lines"}`;
  if (lines === defaultLines) {
    return `Your version and the default of this version both have ${count(lines)}.`;
  }
  return `Your version has ${count(lines)}; the default of this version has ${defaultLines}.`;
}

const CODE_FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * withPlaceholderCode wraps every known placeholder outside a code block in backticks, so Markdown
 * hands it over as inline code. A placeholder already in backticks, or in a fenced block, stays as it is.
 */
export function withPlaceholderCode(text: string): string {
  const names = Object.keys(PLACEHOLDERS);
  const pattern = new RegExp(
    `\`[^\`\n]*\`|${names.map((name) => name.replace(/[{}]/g, "\\$&")).join("|")}`,
    "g",
  );
  let fence: string | null = null;
  return text
    .split("\n")
    .map((line) => {
      const mark = CODE_FENCE.exec(line)?.[1];
      if (fence !== null) {
        if (mark !== undefined && mark[0] === fence[0] && mark.length >= fence.length) {
          fence = null;
        }
        return line;
      }
      if (mark !== undefined) {
        fence = mark;
        return line;
      }
      return line.replace(pattern, (match) => (match.startsWith("`") ? match : `\`${match}\``));
    })
    .join("\n");
}
