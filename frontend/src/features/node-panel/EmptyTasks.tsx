import { ListTodo, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmptyTasksProps {
  kind: "root" | "repo";
  name: string;
  onNewTask: () => void;
}

export function EmptyTasks({ kind, name, onNewTask }: EmptyTasksProps) {
  const title = kind === "root" ? "No tasks in this workspace root" : `No tasks in ${name}`;
  const description =
    kind === "root"
      ? "Tasks created here will be the ones that touch more than one repository."
      : "Tasks created here will be the ones that touch only this repository.";

  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <ListTodo aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="max-w-[32.25rem] text-muted-foreground">{description}</p>
      <Button variant="outline" size="sm" onClick={onNewTask} className="mt-2">
        <Plus />
        New task
      </Button>
    </div>
  );
}
