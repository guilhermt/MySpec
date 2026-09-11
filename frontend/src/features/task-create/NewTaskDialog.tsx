import { type FormEvent, type KeyboardEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findNode, type TreeNode } from "@/features/tree/tree-model";
import {
  isValidTaskName,
  type NameProblem,
  suggestTaskName,
  TASK_NAME_MAX,
  taskNameProblem,
} from "@/lib/task-name";
import { createTask } from "@/store/actions";
import { useAppStore, useTasks } from "@/store/app-store";

const NAME_HELP = "Lowercase letters, digits and hyphens.";

const NAME_PROBLEM_TEXT: Record<Exclude<NameProblem, "empty">, string> = {
  invalid: "Use lowercase letters, digits and single hyphens.",
  too_long: `Use at most ${TASK_NAME_MAX} characters.`,
  taken: "A task with this name already exists in this workspace.",
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function NewTaskDialog() {
  const app = useAppStore((state) => state.app);
  const newTaskFor = useAppStore((state) => state.newTaskFor);

  const node = app === null || newTaskFor === null ? null : findNode(app, newTaskFor);
  if (node === null) {
    return null;
  }
  // The form lives only while the dialog is open, so it opens empty every time.
  return <NewTaskForm node={node} />;
}

function NewTaskForm({ node }: { node: TreeNode }) {
  const closeNewTask = useAppStore((state) => state.closeNewTask);
  const openTask = useAppStore((state) => state.openTask);
  const taken = useTasks().map((task) => task.name);

  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const problem = taskNameProblem(name, taken);
  const suggestion = suggestTaskName(name);
  const canSuggest =
    (problem === "invalid" || problem === "too_long") &&
    suggestion !== name &&
    isValidTaskName(suggestion);
  const canCreate = problem === null && context.trim() !== "" && !creating;

  const create = () => {
    if (!canCreate) {
      return;
    }
    setCreating(true);
    setError(null);
    // No adjustment of models yet: an empty list takes the defaults of the app.
    void createTask({
      name,
      repoPath: node.isRoot ? "" : node.path,
      initialContext: context,
      models: [],
    })
      .then((id) => {
        closeNewTask();
        openTask(id);
      })
      .catch((reason: unknown) => {
        setError(messageOf(reason));
        setCreating(false);
      });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    create();
  };

  const onContextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      create();
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          closeNewTask();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <p className="text-muted-foreground">
            {node.isRoot ? "At the workspace root" : `In ${node.label}`}
          </p>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-name">Name</Label>
            <Input
              id="task-name"
              value={name}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              aria-invalid={problem !== null && problem !== "empty"}
              onChange={(event) => setName(event.target.value)}
              className="font-mono"
            />
            {problem === null || problem === "empty" ? (
              <p className="text-xs text-muted-foreground">{NAME_HELP}</p>
            ) : (
              <p className="flex items-center gap-1 text-xs text-destructive">
                {NAME_PROBLEM_TEXT[problem]}
                {canSuggest && (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={() => setName(suggestion)}
                    className="h-auto p-0"
                  >
                    {`Use "${suggestion}"`}
                  </Button>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-context">Initial context</Label>
            <Textarea
              id="task-context"
              rows={8}
              value={context}
              onChange={(event) => setContext(event.target.value)}
              onKeyDown={onContextKeyDown}
              className="max-h-[40dvh] field-sizing-content"
            />
            <p className="text-xs text-muted-foreground">
              What you want to build, in your own words. High level or detailed.
            </p>
          </div>

          {error !== null && <p className="text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeNewTask}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canCreate}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
