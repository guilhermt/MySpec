import { useEffect } from "react";
import { bootstrap } from "@/app/bootstrap";
import { displayPath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { useAppStore, useWorkspace } from "@/store/app-store";

export function App() {
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let stopped = false;
    void bootstrap(useAppStore).then((dispose) => {
      if (stopped) {
        dispose();
        return;
      }
      unsubscribe = dispose;
    });
    return () => {
      stopped = true;
      unsubscribe?.();
    };
  }, []);

  const app = useAppStore((state) => state.app);
  const workspace = useWorkspace();

  if (app === null) {
    return <div className="h-dvh bg-background" />;
  }

  // Temporary placeholder: the welcome screen and the app shell replace it.
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-2 bg-background text-foreground">
      <h1 className="text-2xl font-semibold">MySpec</h1>
      <p
        className={cn("font-mono text-xs", workspace ? "text-foreground" : "text-muted-foreground")}
      >
        {workspace ? displayPath(workspace.path) : "No workspace open"}
      </p>
    </main>
  );
}
