import { useEffect } from "react";
import { bootstrap } from "@/app/bootstrap";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { ErrorNotice } from "@/features/notice/Notice";
import { useApplyTheme } from "@/features/theme/useApplyTheme";
import { WelcomeScreen } from "@/features/welcome/WelcomeScreen";
import { displayPath } from "@/lib/paths";
import type { Workspace } from "@/lib/wails";
import { useAppStore, useError } from "@/store/app-store";

// Temporary placeholder: the app shell replaces it.
function WorkspacePlaceholder({ workspace }: { workspace: Workspace }) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-2 bg-background text-foreground">
      <h1 className="text-2xl font-semibold">MySpec</h1>
      <p className="font-mono text-xs">{displayPath(workspace.path)}</p>
    </main>
  );
}

export function App() {
  useApplyTheme();
  useGlobalShortcuts();

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
  const setError = useAppStore((state) => state.setError);
  const error = useError();

  if (app === null) {
    return <div className="h-dvh bg-background" />;
  }

  return (
    <>
      {error !== null && (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center p-3">
          <div className="w-full max-w-[560px]">
            <ErrorNotice message={error} onDismiss={() => setError(null)} />
          </div>
        </div>
      )}
      {app.workspace === null ? (
        <WelcomeScreen />
      ) : (
        <WorkspacePlaceholder workspace={app.workspace} />
      )}
    </>
  );
}
