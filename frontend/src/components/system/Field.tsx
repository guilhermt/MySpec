import { createContext, type ReactNode, useContext, useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label: string;
  complement?: string;
  help?: string;
  error?: string;
  count?: { length: number; max: number };
  children: ReactNode;
  className?: string;
}

/** FieldControl is what a Field hands to the control inside it. */
export interface FieldControl {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldControl | null>(null);

/** useFieldControl returns the Field around a control, or null outside one. */
export function useFieldControl(): FieldControl | null {
  return useContext(FieldContext);
}

/** COUNT_NEAR is how close to the limit the counter starts to show. */
const COUNT_NEAR = 20;

/** Field is a labelled control with its help or error line and its counter near the limit. */
export function Field({ label, complement, help, error, count, children, className }: FieldProps) {
  const controlId = useId();
  const noteId = useId();
  const countId = useId();
  const note = error ?? help;
  const showCount = count !== undefined && count.length >= count.max - COUNT_NEAR;
  const ids = [note !== undefined ? noteId : "", showCount ? countId : ""].filter(Boolean);
  const control: FieldControl = {
    controlId,
    describedBy: ids.length > 0 ? ids.join(" ") : undefined,
    invalid: error !== undefined,
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label
        htmlFor={controlId}
        className="text-(length:--text-meta) leading-(--leading-meta) font-medium text-ink-2"
      >
        {label}
        {complement !== undefined && " "}
        {complement !== undefined && <span className="font-normal text-ink-3">{complement}</span>}
      </Label>
      <FieldContext.Provider value={control}>{children}</FieldContext.Provider>
      {(note !== undefined || showCount) && (
        <div className="flex gap-2 text-(length:--text-micro) leading-(--leading-micro)">
          {note !== undefined && (
            <span id={noteId} className={error !== undefined ? "text-state-error" : "text-ink-3"}>
              {note}
            </span>
          )}
          {showCount && (
            <span id={countId} className="ml-auto tabular-nums text-ink-3">
              {`${count.length}/${count.max}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
