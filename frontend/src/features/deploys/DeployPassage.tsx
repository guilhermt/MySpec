// biome-ignore-all lint/a11y/useSemanticElements: a cell of the CSS grid of the matrix, a gridcell by its role
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { Tooltip } from "@/components/system/Tooltip";
import type { PassageModel } from "@/features/deploys/deploy-matrix";
import { SLOT_ATTRIBUTE } from "@/features/deploys/useDeployGridKeyboard";
import { cn } from "@/lib/utils";

export interface DeployPassageProps {
  model: PassageModel;
  tabIndex: 0 | -1;
  open: boolean;
  onActivate: () => void;
}

/**
 * DeployPassage is the line between two environments of a repository, drawn at the middle of the
 * row: a hairline with nothing to promote, an arrow with what waits when something does, a dashed
 * line while the deploy runs.
 */
export function DeployPassage({ model, tabIndex, open, onActivate }: DeployPassageProps) {
  const text = model.busy ? (
    <span className="inline-flex items-center gap-(--space-1-5)">
      <Spinner />
      {model.text}
    </span>
  ) : (
    model.text
  );
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the grid owns the keyboard of its cells
    <div
      role="gridcell"
      tabIndex={tabIndex}
      aria-label={model.label}
      aria-selected={open}
      {...{ [SLOT_ATTRIBUTE]: model.key }}
      onClick={onActivate}
      className={cn(
        "relative flex min-h-(--size-ask) min-w-0 cursor-pointer items-center justify-center rounded-sm outline-none focus-visible:focus-ring",
        open && "bg-brand-veil",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-[round(up,50%,1px)]",
          model.dashed
            ? "border-t-(length:--border) border-dashed border-state-github"
            : model.lit
              ? "h-(--border-2) bg-ink-1"
              : "h-(--border) bg-line-1",
        )}
      />
      {model.lit && !model.dashed && (
        <Icon
          icon={ICONS.promote}
          size="sm"
          className="absolute top-[round(up,50%,1px)] right-0 -translate-y-1/2 text-ink-1"
        />
      )}
      {model.text !== "" && (
        <Tooltip content={model.label}>
          <span
            aria-hidden="true"
            className="relative bg-surface-1 px-(--space-1-5) text-(length:--text-meta) leading-(--leading-meta) font-semibold whitespace-nowrap text-ink-1"
          >
            <span className="@max-[48rem]/deploys:hidden">{text}</span>
            <span className="hidden @max-[48rem]/deploys:inline">
              {model.busy ? <Spinner /> : model.short}
            </span>
          </span>
        </Tooltip>
      )}
    </div>
  );
}
