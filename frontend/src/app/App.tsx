import { useEffect } from "react";
import { AppShell } from "@/app/AppShell";
import { bootstrap } from "@/app/bootstrap";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { MigrationRefused } from "@/features/migration/MigrationRefused";
import { StartScreen } from "@/features/startup/StartScreen";
import { useApplyTheme } from "@/features/theme/useApplyTheme";
import { WelcomeScreen } from "@/features/welcome/WelcomeScreen";
import { useAppStore } from "@/store/app-store";

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

  if (app === null) {
    return <StartScreen />;
  }

  // A refused migration takes the whole app: nothing else was loaded.
  if (app.migration !== null) {
    return <MigrationRefused migration={app.migration} />;
  }

  return (app.repositories ?? []).length === 0 && (app.boards ?? []).length === 0 ? (
    <WelcomeScreen />
  ) : (
    <AppShell />
  );
}
