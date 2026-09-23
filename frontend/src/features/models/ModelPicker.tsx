import { ChevronsUpDown, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  catalogFailureMessage,
  catalogModel,
  catalogModels,
  choiceLabel,
  choiceUnavailable,
  type ModelChoice,
  modelLabel,
  takesEffort,
} from "@/lib/models";
import { cn } from "@/lib/utils";
import { asCatalogFailure } from "@/lib/wails";
import { useModelCatalog } from "@/store/app-store";

export interface ModelPickerProps {
  value: ModelChoice;
  onChange: (choice: ModelChoice) => void;
  /** label names what the choice is for, as a screen reader says it: "PRD", "Step 4", "Session". */
  label: string;
  /** field is a bordered control of a form; inline is text-sized, for a list or a line of hints. */
  variant?: "field" | "inline";
  /** muted reads the value quietly, as a step that follows Implementation does. */
  muted?: boolean;
}

/** ModelPicker is the one control that picks a model and an effort, wherever the app offers it. */
export function ModelPicker({
  value,
  onChange,
  label,
  variant = "field",
  muted = false,
}: ModelPickerProps) {
  const catalog = useModelCatalog();
  const models = catalogModels(catalog);
  const current = catalogModel(catalog, value.model);
  const efforts = current?.efforts ?? [];
  const failure = asCatalogFailure(catalog.failure);
  const unavailable = choiceUnavailable(catalog, value);
  const choiceText = choiceLabel(catalog, value);

  const pickModel = (model: string) => {
    if (model !== value.model) {
      onChange({ ...value, model });
    }
  };

  const pickEffort = (effort: string) => {
    if (effort !== value.effort) {
      onChange({ ...value, effort });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant === "field" ? "outline" : "ghost"}
            size={variant === "field" ? "sm" : "xs"}
          />
        }
        aria-label={`${label} model: ${choiceText}${unavailable ? " · unavailable" : ""}`}
        className={cn(
          "tabular-nums",
          variant === "field" && "min-w-40 justify-between",
          variant === "inline" && !muted && "font-medium",
          muted && "text-muted-foreground",
        )}
      >
        <span>{choiceText}</span>
        {unavailable && <UnavailableMark />}
        <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "field" ? "start" : "end"} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          {models.length === 0 && failure !== "" && (
            <DropdownMenuItem disabled className="whitespace-normal">
              {catalogFailureMessage(failure)}
            </DropdownMenuItem>
          )}
          <DropdownMenuRadioGroup value={value.model} onValueChange={pickModel}>
            {models.map((model) => (
              <DropdownMenuRadioItem key={model.name} value={model.name}>
                {modelLabel(model.name)}
              </DropdownMenuRadioItem>
            ))}
            {current === undefined && (
              <DropdownMenuRadioItem value={value.model} disabled>
                {modelLabel(value.model)} · unavailable
              </DropdownMenuRadioItem>
            )}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        {takesEffort(catalog, value.model) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Effort</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={value.effort} onValueChange={pickEffort}>
                {efforts.map((effort) => (
                  <DropdownMenuRadioItem key={effort} value={effort}>
                    {effort}
                  </DropdownMenuRadioItem>
                ))}
                {value.effort !== "" && !efforts.includes(value.effort) && (
                  <DropdownMenuRadioItem value={value.effort} disabled>
                    {value.effort} · unavailable
                  </DropdownMenuRadioItem>
                )}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** UnavailableMark says a choice names what the installed Claude Code doesn't offer. Text carries it; the tone only stresses it. */
export function UnavailableMark() {
  return (
    <span className="inline-flex items-center gap-1 text-[var(--status-attention)]">
      <TriangleAlert aria-hidden="true" className="size-3" />
      unavailable
    </span>
  );
}

/** ModelValue is a choice that can no longer change, written the way the picker writes it. */
export function ModelValue({ value, className }: { value: ModelChoice; className?: string }) {
  const catalog = useModelCatalog();

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums", className)}>
      {choiceLabel(catalog, value)}
      {choiceUnavailable(catalog, value) && <UnavailableMark />}
    </span>
  );
}
