import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { choiceLabel, EFFORTS, MODELS, type ModelChoice } from "@/lib/models";
import { cn } from "@/lib/utils";

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
        aria-label={`${label} model: ${choiceLabel(value)}`}
        className={cn(
          "tabular-nums",
          variant === "field" && "min-w-40 justify-between",
          variant === "inline" && !muted && "font-medium",
          muted && "text-muted-foreground",
        )}
      >
        <span>{choiceLabel(value)}</span>
        <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "field" ? "start" : "end"} className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value.model} onValueChange={pickModel}>
            {MODELS.map((model) => (
              <DropdownMenuRadioItem key={model.id} value={model.id}>
                {model.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Effort</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value.effort} onValueChange={pickEffort}>
            {EFFORTS.map((effort) => (
              <DropdownMenuRadioItem key={effort} value={effort}>
                {effort}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** ModelValue is a choice that can no longer change, written the way the picker writes it. */
export function ModelValue({ value, className }: { value: ModelChoice; className?: string }) {
  return <span className={cn("text-xs tabular-nums", className)}>{choiceLabel(value)}</span>;
}
