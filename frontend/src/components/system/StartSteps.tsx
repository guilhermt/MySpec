import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { Spinner } from "./Spinner";
import { StateGlyph } from "./StateGlyph";

export interface StartStepView {
  id: string;
  label: string;
  state: "done" | "running" | "todo";
  elapsed: string;
  reason: string;
}

export interface StartStepsProps {
  steps: readonly StartStepView[];
}

/** StartSteps is the list of what the start does, each step done, running or still to do; the parent announces it. */
export function StartSteps({ steps }: StartStepsProps) {
  return (
    <ol className="m-0 flex list-none flex-col gap-(--space-2) p-0">
      {steps.map((step) => (
        <li
          key={step.id}
          className="grid grid-cols-[var(--icon)_1fr_auto] items-center gap-x-(--space-2)"
        >
          {step.state === "done" && <Icon icon={ICONS.done} size="sm" tone="muted" />}
          {step.state === "running" && <Spinner />}
          {step.state === "todo" && <StateGlyph state="todo" />}
          <span
            className={cn(
              "text-(length:--text-ui) leading-(--leading-ui)",
              step.state === "done" && "text-ink-1",
              step.state === "running" && "font-medium text-ink-1",
              step.state === "todo" && "text-ink-3",
            )}
          >
            {step.label}
          </span>
          <span className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3 tabular-nums">
            {[step.elapsed, step.reason].filter((part) => part !== "").join(" ")}
          </span>
        </li>
      ))}
    </ol>
  );
}
