import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/system/BrandMark";
import { Button } from "@/components/system/Button";
import { CopyBlock } from "@/components/system/CopyBlock";
import { StartSteps } from "@/components/system/StartSteps";
import { StateGlyph } from "@/components/system/StateGlyph";
import { useNow } from "@/features/attention/useNow";
import { StartSidebar } from "@/features/startup/StartSidebar";
import { failureError, failureText, MAIN_DELAY_MS, stepViews } from "@/features/startup/start";
import { cn } from "@/lib/utils";
import { asStartupPhase } from "@/lib/wails";
import { tryStartupAgain } from "@/store/actions";
import { useSidebarRail, useStartup } from "@/store/app-store";

/** COLUMN is the reading column of the start, below the head of the window. */
const COLUMN = "start-column flex flex-col gap-(--space-8)";

const TITLE =
  "m-0 text-(length:--text-display) leading-(--leading-display) font-semibold text-ink-1";

/**
 * StartScreen is the window before the first state: the sidebar in skeleton and, in the main area,
 * the steps of the start or, when it failed, why. The steps wait a moment for a start that is
 * quick; the failure shows at once.
 */
export function StartScreen() {
  const startup = useStartup();
  const rail = useSidebarRail();
  const failed = startup !== null && asStartupPhase(startup.phase) === "failed";
  const now = useNow(1000, startup !== null && !failed);
  const [waited, setWaited] = useState(false);
  const retry = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), MAIN_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (failed) {
      retry.current?.focus();
    }
  }, [failed]);

  // Enter with the focus on the body of the screen tries again, as it does on the button.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (failed && event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      void tryStartupAgain();
    }
  };

  return (
    <div
      className={cn(
        "grid h-dvh",
        rail
          ? "grid-cols-[var(--sidebar-collapsed)_minmax(0,1fr)]"
          : "grid-cols-[var(--sidebar-width)_minmax(0,1fr)]",
      )}
    >
      <StartSidebar still={failed} />
      <main
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="main-area relative h-dvh min-w-0 bg-surface-1 outline-none"
      >
        {failed && startup.failure !== null ? (
          <div role="alert" className={COLUMN}>
            <div className="flex flex-col gap-(--space-3)">
              <div className="flex items-center gap-(--space-3)">
                <StateGlyph state="error" className="size-(--space-4)" />
                <h1 className={TITLE}>MySpec couldn't start</h1>
              </div>
              <p className="m-0 text-(length:--text-body) leading-(--leading-body) text-ink-2">
                {failureText(startup.failure)}
              </p>
            </div>
            <CopyBlock
              label="error"
              copyLabel="Copy the error"
              text={failureError(startup.failure)}
            />
            <div>
              <Button
                ref={retry}
                variant="primary"
                shortcut="Enter"
                onClick={() => void tryStartupAgain()}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : (
          waited &&
          startup !== null && (
            <div className={COLUMN}>
              <BrandMark size="lg" />
              <h1 className={TITLE}>Starting MySpec…</h1>
              <div role="status" aria-live="polite">
                <StartSteps steps={stepViews(startup, now)} />
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
