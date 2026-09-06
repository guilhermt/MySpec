import { ListTodo } from "lucide-react";

export interface EmptyTasksProps {
  kind: "root" | "repo";
  name: string;
}

export function EmptyTasks({ kind, name }: EmptyTasksProps) {
  const title = kind === "root" ? "No tasks in this workspace root" : `No tasks in ${name}`;
  const description =
    kind === "root"
      ? "Tasks created here will be the ones that touch more than one repository."
      : "Tasks created here will be the ones that touch only this repository.";

  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <ListTodo aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="max-w-[420px] text-muted-foreground">{description}</p>
    </div>
  );
}
