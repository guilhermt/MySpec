import { asTaskMode, type TaskSummary } from "@/lib/wails";

/** ArtifactEntry is one written document of a task, a row of the panel. */
export interface ArtifactEntry {
  /** file is the artifact name for readArtifact. */
  file: string;
  label: string;
  /** meta is what the row says on the right: approved, for the draft of an open pull request. */
  meta: string;
  /** step reads a step file, without its metadata header. */
  step: boolean;
}

/** ArtifactGroup is a titled group of written documents. */
export interface ArtifactGroup {
  legend: string;
  entries: ArtifactEntry[];
}

/** artifactGroupsOf is every document the task has written, in its groups, each only with entries. */
export function artifactGroupsOf(task: TaskSummary): ArtifactGroup[] {
  const oneShot = asTaskMode(task.mode) === "one_shot";
  const entry = (file: string, label: string, meta = "", step = false): ArtifactEntry => ({
    file,
    label,
    meta,
    step,
  });
  const documents = oneShot
    ? [task.hasOneShot && entry("one-shot.md", "One-Shot document")]
    : [
        task.hasPrd && entry("PRD.md", "PRD"),
        task.hasTechSpec && entry("tech-spec.md", "Tech spec"),
      ];
  const steps = oneShot ? [] : (task.steps ?? []);
  const draft = task.pr?.draft ?? null;
  const groups: ArtifactGroup[] = [
    {
      legend: "Documents",
      entries: documents.filter((document) => document !== false),
    },
    {
      legend: `Step files · ${steps.length}`,
      entries: steps.map((step) =>
        entry(`steps/${step.file}`, `${step.number} · ${step.title}`, "", true),
      ),
    },
    {
      legend: "Pull request",
      entries:
        draft === null
          ? []
          : [
              entry(
                `pr/${draft.file}`,
                `Draft · ${draft.title}`,
                (task.pr?.prNumber ?? 0) > 0 ? "approved" : "",
              ),
            ],
    },
  ];
  return groups.filter((group) => group.entries.length > 0);
}
