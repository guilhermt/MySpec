import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { Pill, type PillView } from "./Pill";
import { Shimmer } from "./Shimmer";
import { StateGlyph } from "./StateGlyph";
import { Tooltip } from "./Tooltip";

/** StepperStepView is one stage of the stepper. */
export interface StepperStepView {
  id: string;
  name: string;
  state: "done" | "current" | "upcoming";
}

export interface StepperProps {
  steps: readonly StepperStepView[];
  pill: PillView;
  /** label is the accessible name, the whole progress: "Progress · Implementation 3/7 · …". */
  label: string;
  /** tooltip is the list of the stages, and the time of a pause on a second line. */
  tooltip: readonly string[];
  /** loading glows over the names with no pill, before the first snapshot of the task. */
  loading?: boolean;
}

/** FOLDED_WORD is what the reader hears after the name of a stage that is not the current one. */
const FOLDED_WORD = { done: "done", upcoming: "to come" } as const;

/** FOLDS is where the name of a stage gives way to the tooltip, by main area width. */
const FOLDS = {
  done: "@max-[1200px]/main:sr-only",
  upcoming: "@max-[900px]/main:sr-only",
} as const;

/**
 * Stepper is the progress of an item: the stages in order, the done ones with a check, the ones to
 * come with a circle and the current one as the pill. It is one Tab stop with no action; its tooltip,
 * the list of the stages, opens on keyboard focus and on hover over the pill. It gives way by the
 * width of the main area: the dashes below 1300px, the names of the done stages below 1200px, the
 * qualifier and the word of the pill below 1040px, the names of the stages to come below 900px.
 */
export function Stepper({ steps, pill, label, tooltip, loading = false }: StepperProps) {
  return (
    <Tooltip content={tooltip} hover={false}>
      <ol
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the stepper is one stop that says the progress and opens its list
        tabIndex={0}
        aria-label={label}
        aria-busy={loading || undefined}
        className="ml-(--space-2) flex shrink-0 items-center gap-(--space-1-5) rounded-sm text-(length:--text-meta) leading-(--leading-meta) whitespace-nowrap outline-none focus-visible:focus-ring @max-[1300px]/main:gap-(--space-2-5) @max-[1200px]/main:gap-(--space-2) @max-[1040px]/main:ml-0"
      >
        {steps.map((step, index) => (
          <li
            key={step.id}
            aria-current={step.state === "current" && !loading ? "step" : undefined}
            className="flex items-center gap-(--space-1-5)"
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className="h-(--border) w-(--space-3) shrink-0 bg-line-2 @max-[1300px]/main:hidden"
              />
            )}
            {step.state === "current" && !loading ? (
              <Tooltip content={tooltip}>
                <span className="inline-flex">
                  <Pill pill={pill} />
                </span>
              </Tooltip>
            ) : (
              <Folded step={step} loading={loading} />
            )}
          </li>
        ))}
      </ol>
    </Tooltip>
  );
}

/** Folded is a stage that is not the current one: the sign and the name, which can fold into the sign. */
function Folded({ step, loading }: { step: StepperStepView; loading: boolean }) {
  const kind = step.state === "done" ? "done" : "upcoming";
  const word = FOLDED_WORD[kind];
  return (
    <Tooltip content={`${step.name} · ${word}`}>
      <span
        data-stage={kind}
        className={cn(
          "inline-flex items-center gap-(--space-1-5) @max-[1040px]/main:gap-(--space-1)",
          kind === "done" ? "text-ink-3" : "text-ink-4",
        )}
      >
        {kind === "done" ? (
          <Icon icon={ICONS.done} size="xs" className="text-ink-3" />
        ) : (
          <StateGlyph state="todo" size="sm" />
        )}
        <span className={FOLDS[kind]}>{loading ? <Shimmer>{step.name}</Shimmer> : step.name}</span>
        <span className="sr-only"> · {word}</span>
      </span>
    </Tooltip>
  );
}
