import { Copy, FolderGit2, House, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyTasks } from "@/features/node-panel/EmptyTasks";
import { TaskList } from "@/features/node-panel/TaskList";
import { Notice } from "@/features/notice/Notice";
import { findNode } from "@/features/tree/tree-model";
import { asNoticeReason } from "@/lib/wails";
import { dismissNotice } from "@/store/actions";
import { useAppStore, useNotice, useTasksOf } from "@/store/app-store";

export function NodePanel() {
  const app = useAppStore((state) => state.app);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const openNewTask = useAppStore((state) => state.openNewTask);
  const tasks = useTasksOf(selectedNodeId);
  const notice = useNotice();

  const node = app === null ? null : findNode(app, selectedNodeId);
  if (node === null) {
    return <main className="h-dvh bg-background" />;
  }

  const Icon = node.isRoot ? House : FolderGit2;

  return (
    <main className="h-dvh overflow-auto bg-background p-8 text-foreground">
      <div className="flex w-full max-w-[55.5rem] flex-col">
        {notice !== null && (
          <Notice
            path={notice.path}
            reason={asNoticeReason(notice.reason)}
            onDismiss={() => void dismissNotice()}
          />
        )}

        <header className="flex flex-col gap-1 pt-4 first:pt-0">
          <div className="flex items-center gap-2">
            <Icon aria-hidden="true" className="size-6 shrink-0 text-muted-foreground" />
            <h1 className="text-[1.5rem] font-semibold">{node.label}</h1>
            {node.isRoot && <Badge variant="secondary">Root</Badge>}
            <span className="flex-1" />
            <Button size="sm" onClick={() => openNewTask(node.id)}>
              <Plus />
              New task
            </Button>
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate font-mono text-sm text-muted-foreground">{node.path}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy path"
              onClick={() => void navigator.clipboard.writeText(node.path)}
            >
              <Copy />
            </Button>
          </div>
        </header>

        <Separator className="my-6" />

        {tasks.length === 0 ? (
          <EmptyTasks
            kind={node.isRoot ? "root" : "repo"}
            name={node.label}
            onNewTask={() => openNewTask(node.id)}
          />
        ) : (
          <TaskList tasks={tasks} />
        )}
      </div>
    </main>
  );
}
