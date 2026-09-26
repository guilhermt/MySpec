import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export interface FieldProps {
  label: string;
  complement?: string;
  help?: string;
  error?: string;
  count?: { length: number; max: number };
  children: ReactNode;
  className?: string;
}

/** ControlLine is what a control inside a Field shows on the help line: its disabled reason and its gerund. */
export interface ControlLine {
  reason?: string | undefined;
  loadingLabel?: string | undefined;
}

/** FieldControl is what a Field hands to the control inside it. */
export interface FieldControl {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  report: (line: ControlLine) => void;
}

const FieldContext = createContext<FieldControl | null>(null);

/** useFieldControl returns the Field around a control, or null outside one. */
export function useFieldControl(): FieldControl | null {
  return useContext(FieldContext);
}

/** COUNT_NEAR is how close to the limit the counter starts to show. */
const COUNT_NEAR = 20;

/** LINE is the type of the help line under a field and under a control outside one. */
const LINE = "text-(length:--text-micro) leading-(--leading-micro)";

/**
 * Field is a labelled control with its help or error line and its counter near the limit. The
 * control reports its disabled reason and its gerund, which the line shows next to the help.
 */
export function Field({ label, complement, help, error, count, children, className }: FieldProps) {
  const controlId = useId();
  const noteId = useId();
  const countId = useId();
  const reasonId = useId();
  const loadingId = useId();
  const [line, report] = useState<ControlLine>({});
  const note = error ?? help;
  const showCount = count !== undefined && count.length >= count.max - COUNT_NEAR;
  const ids = [
    line.loadingLabel !== undefined ? loadingId : "",
    note !== undefined ? noteId : "",
    line.reason !== undefined ? reasonId : "",
    showCount ? countId : "",
  ].filter(Boolean);
  const control: FieldControl = {
    controlId,
    describedBy: ids.length > 0 ? ids.join(" ") : undefined,
    invalid: error !== undefined,
    report,
  };
  const shown =
    note !== undefined || showCount || line.reason !== undefined || line.loadingLabel !== undefined;

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
      {shown && (
        <div className={cn("flex flex-wrap gap-2", LINE)}>
          {line.loadingLabel !== undefined && <Loading id={loadingId} label={line.loadingLabel} />}
          {note !== undefined && (
            <span id={noteId} className={error !== undefined ? "text-state-error" : "text-ink-3"}>
              {note}
            </span>
          )}
          {line.reason !== undefined && (
            <span id={reasonId} className="text-ink-3">
              {line.reason}
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

/** Loading is the spinner and the gerund of a control that is working. */
function Loading({ id, label }: { id: string; label: string }) {
  return (
    <span id={id} className="inline-flex items-center gap-1.5 text-ink-3">
      <Spinner tone="current" />
      {label}
    </span>
  );
}

/** ControlStateProps are the common states a text control takes besides its value. */
export interface ControlStateProps {
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  loading?: boolean | undefined;
  loadingLabel?: string | undefined;
}

/** ControlState is how a text control carries its states: its attributes and the wrap of its line. */
export interface ControlState {
  attributes: {
    id?: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
    "aria-disabled"?: true;
    "aria-busy"?: true;
    readOnly?: true;
  };
  wrap: (control: ReactElement) => ReactElement;
}

/**
 * useControlState wires a text control to the Field around it: the id, the description, the error,
 * and the disabled reason and the gerund on the help line. Outside a Field, the control carries the
 * line itself, next to it. Disabled, the control stays focusable and read-only.
 */
export function useControlState({
  disabled,
  disabledReason,
  loading,
  loadingLabel,
}: ControlStateProps): ControlState {
  const field = useFieldControl();
  const ownId = useId();
  const reason = disabled && disabledReason !== undefined ? disabledReason : undefined;
  const gerund = loading ? loadingLabel : undefined;
  const report = field?.report;

  useEffect(() => {
    if (report === undefined) return;
    report({ reason, loadingLabel: gerund });
    return () => report({});
  }, [report, reason, gerund]);

  const own = field === null && (reason !== undefined || gerund !== undefined);
  const describedBy = [field?.describedBy, own ? ownId : undefined].filter(Boolean).join(" ");
  const attributes: ControlState["attributes"] = {
    ...(field !== null ? { id: field.controlId } : {}),
    ...(field?.invalid ? { "aria-invalid": true } : {}),
    ...(describedBy !== "" ? { "aria-describedby": describedBy } : {}),
    ...(disabled ? { "aria-disabled": true, readOnly: true } : {}),
    ...(loading ? { "aria-busy": true } : {}),
  };

  const wrap = (control: ReactElement) => {
    if (!own) return control;
    return (
      <span className="inline-flex items-center gap-2">
        {control}
        {gerund !== undefined ? (
          <span className={LINE}>
            <Loading id={ownId} label={gerund} />
          </span>
        ) : (
          <span id={ownId} className={cn("text-ink-3", LINE)}>
            {reason}
          </span>
        )}
      </span>
    );
  };

  return { attributes, wrap };
}
