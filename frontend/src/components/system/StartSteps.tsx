import { cn } from "@/lib/utils";
import { CutText } from "./CutText";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { Spinner } from "./Spinner";
import { StateGlyph } from "./StateGlyph";

export interface StartStepView {
  id: string;
  label: string;
  state: "done" | "running" | "todo";
  /** elapsed is the time of a slow step; "" otherwise. */
  elapsed: string;
  /** reason is why a slow step waits, like ~/code/infra doesn't answer; "" without one. */
  reason: string;
}

export interface StartStepsProps {
  steps: readonly StartStepView[];
}

/**
 * StartSteps is the list of what the start does, each step done, running or still to do; the parent
 * announces it. The label stays whole, and the reason of a slow step, a path that may be long, is
 * what the space cuts.
 */
export function StartSteps({ steps }: StartStepsProps) {
  return (
    <ol className="m-0 flex list-none flex-col gap-(--space-2) p-0">
      {steps.map((step) => (
        <li
          key={step.id}
          className="grid grid-cols-[var(--icon)_auto_minmax(0,1fr)] items-center gap-x-(--space-2)"
        >
          {step.state === "done" && <Icon icon={ICONS.done} size="sm" tone="muted" />}
          {step.state === "running" && <Spinner />}
          {step.state === "todo" && <StateGlyph state="todo" />}
          <span
            className={cn(
              "whitespace-nowrap text-(length:--text-ui) leading-(--leading-ui)",
              step.state === "done" && "text-ink-1",
              step.state === "running" && "font-medium text-ink-1",
              step.state === "todo" && "text-ink-3",
            )}
          >
            {step.label}
          </span>
          <span className="flex min-w-0 justify-end gap-(--space-1) text-(length:--text-meta) leading-(--leading-meta) text-ink-3 tabular-nums">
            {step.elapsed !== "" && <span className="shrink-0">{step.elapsed}</span>}
            {step.reason !== "" && (
              <>
                {" "}
                <span className="shrink-0">·</span> <CutText text={step.reason} />
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
