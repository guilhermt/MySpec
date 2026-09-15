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
  { stage: "pr", name: "PR", description: "Opens the pull request session of each repository." },
  {
    stage: "pr_review",
    name: "PR review",
    description: "Opens the review session of each pull request.",
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
  "{{repositories}}": { meaning: "The list of the repositories the task may touch" },
  "{{initial_context}}": {
    meaning: "The initial context written when the task was created",
    whenRemoved: "Without it, the initial context is added at the end.",
  },
  "{{repository}}": { meaning: "The repository of the session" },
  "{{branch}}": { meaning: "The branch of the task in this repository" },
  "{{base_branch}}": { meaning: "The base branch of the worktree and the pull request" },
  "{{draft_path}}": { meaning: "The file the agent writes the pull request draft to" },
  "{{review_path}}": { meaning: "The file the agent writes the review report to" },
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
