import { ListTodo, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useAppStore, useTasks } from "@/store/app-store";

/**
 * Home is the main area with nothing else open: what to do next and the way to
 * do it.
 */
export function Home() {
  const openNewTask = useAppStore((state) => state.openNewTask);
  const tasks = useTasks();

  const title = tasks.length === 0 ? "No tasks yet" : "No task open";
  const description =
    tasks.length === 0
      ? "Create the first task in one of your repositories."
      : "Pick a task from the list, or create a new one.";

  return (
    <section className="flex min-h-0 flex-1 items-center justify-center bg-background p-8 text-foreground">
      <div className="flex max-w-[32.25rem] flex-col items-center gap-2 text-center">
        <ListTodo aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{description}</p>
        <Button size="sm" className="mt-2" onClick={() => openNewTask()}>
          <Plus />
          New task
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>N</Kbd>
          </KbdGroup>
        </Button>
      </div>
    </section>
  );
}
