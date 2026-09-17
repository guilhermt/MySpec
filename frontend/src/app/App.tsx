import { useEffect } from "react";
import { AppShell } from "@/app/AppShell";
import { bootstrap } from "@/app/bootstrap";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { MigrationRefused } from "@/features/migration/MigrationRefused";
import { ArchivedNotice } from "@/features/notice/ArchivedNotice";
import { LeftoversNotice } from "@/features/notice/LeftoversNotice";
import { ErrorNotice } from "@/features/notice/Notice";
import { useApplyTheme } from "@/features/theme/useApplyTheme";
import { WelcomeScreen } from "@/features/welcome/WelcomeScreen";
import { useAppStore, useError, useLeftover } from "@/store/app-store";

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
  const leftover = useLeftover();

  if (app === null) {
    return <div className="h-dvh bg-background" />;
  }

  // A refused migration takes the whole app: nothing else was loaded.
  if (app.migration !== null) {
    return <MigrationRefused migration={app.migration} />;
  }

  return (
    <>
      {(error !== null || leftover !== null) && (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center p-3">
          <div className="flex w-full max-w-[43rem] flex-col gap-2">
            {error !== null && <ErrorNotice message={error} onDismiss={() => setError(null)} />}
            <LeftoversNotice />
          </div>
        </div>
      )}
      {(app.repositories ?? []).length === 0 && (app.boards ?? []).length === 0 ? (
        <WelcomeScreen />
      ) : (
        <>
          <AppShell />
          <ArchivedNotice />
        </>
      )}
    </>
  );
}
