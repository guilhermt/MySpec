import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import { X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, type RefObject, useRef } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Dialog as UIDialog,
  DialogClose as UIDialogClose,
  DialogContent as UIDialogContent,
  DialogTitle as UIDialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button, type ButtonBaseProps, type ButtonLoading } from "./Button";
import { IconButton } from "./IconButton";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  size?: "default" | "wide";
  alert?: boolean;
  onConfirm?: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/* The width keeps --space-8 free in a narrow window; the max width is the one of the system. */
const CONTENT =
  "flex max-h-[calc(100dvh-2*round(8vh,1px))] w-[calc(100%-var(--space-8))] flex-col gap-0 overflow-hidden rounded-xl bg-surface-3 p-0 text-ink-1 shadow-overlay ring-0 duration-(--duration-base)";

/* The alert primitive sets its max width per data-size, so those variants are replaced too. */
const WIDTHS = {
  default:
    "max-w-(--size-dialog) sm:max-w-(--size-dialog) data-[size=default]:max-w-(--size-dialog) data-[size=default]:sm:max-w-(--size-dialog)",
  wide: "max-w-(--size-dialog-wide) sm:max-w-(--size-dialog-wide) data-[size=default]:max-w-(--size-dialog-wide) data-[size=default]:sm:max-w-(--size-dialog-wide)",
} as const;

const TITLE =
  "flex-1 font-sans text-(length:--text-title) leading-(--leading-title) font-semibold text-balance";

/**
 * Dialog is the system dialog: a header with the title and the close button, a body and a footer.
 * Its variants are compositions:
 * - minimal: size="default", with alert on a confirmation;
 * - wide: size="wide";
 * - in steps: subtitle with the step, a DialogFooter with back from the second step and refusal;
 * - destructive: alert, with the confirmation as a danger Button.
 * Without initialFocus, an alert opens on its DialogCancel and the others on the first field of the
 * body, or on the dialog itself when the body has none; never on the close button.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  subtitle,
  size = "default",
  alert,
  onConfirm,
  initialFocus,
  children,
}: DialogProps) {
  const popup = useRef<HTMLDivElement>(null);
  const firstFocus = () => {
    const sheet = popup.current;
    if (sheet === null) return true;
    return sheet.querySelector<HTMLElement>(alert ? CANCEL : FIELD) ?? sheet;
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (onConfirm !== undefined && event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      onConfirm();
    }
  };
  const content = {
    ref: popup,
    initialFocus: initialFocus ?? firstFocus,
    // Base UI makes the rest of the page inert without saying so; aria-modal says it.
    "aria-modal": true,
    onKeyDown: handleKeyDown,
    className: cn(CONTENT, WIDTHS[size]),
  };
  const heading = (
    <DialogHeading
      title={title}
      {...(subtitle !== undefined ? { subtitle } : {})}
      alert={alert === true}
    />
  );

  if (alert) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent {...content}>
          {heading}
          {children}
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  return (
    <UIDialog open={open} onOpenChange={onOpenChange}>
      <UIDialogContent showCloseButton={false} {...content}>
        {heading}
        {children}
      </UIDialogContent>
    </UIDialog>
  );
}

/** DialogHeading is the title, the subtitle and the close button, in the parts of the chosen primitive. */
function DialogHeading({
  title,
  subtitle,
  alert,
}: {
  title: string;
  subtitle?: string;
  alert: boolean;
}) {
  const Title = alert ? AlertDialogTitle : UIDialogTitle;
  const Close = alert ? BaseAlertDialog.Close : UIDialogClose;
  return (
    <div className="flex items-start gap-3 px-5 pt-5 pb-2">
      <div className="flex flex-1 flex-col">
        <Title className={TITLE}>{title}</Title>
        {subtitle !== undefined && (
          <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
            {subtitle}
          </p>
        )}
      </div>
      <Close render={<IconButton label="Close" shortcut="Esc" icon={X} size="sm" />} />
    </div>
  );
}

/** CANCEL finds the DialogCancel of a dialog, where an alert opens. */
const CANCEL = "[data-dialog-cancel]";

/** FIELD finds the first field of a dialog body that takes the focus, where the others open. */
const FIELD =
  "[data-dialog-body] :is(input:not([type=hidden]), textarea, select, [role=combobox]):not(:disabled)";

export interface DialogBodyProps {
  children: ReactNode;
  className?: string;
}

/** DialogBody is the scrolling middle of a dialog. */
export function DialogBody({ children, className }: DialogBodyProps) {
  return (
    <div
      data-dialog-body=""
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4 text-(length:--text-body) leading-(--leading-body) text-ink-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface DialogFooterProps {
  children: ReactNode;
  back?: ReactNode;
  reason?: { id: string; text: string };
  refusal?: string;
}

/** DialogFooter holds the refusal, Back or the disabled reason on the left, and Cancel and the confirmation. */
export function DialogFooter({ children, back, reason, refusal }: DialogFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 bg-surface-0 px-5 py-3 shadow-[inset_0_var(--border)_0_var(--line-1)]">
      {refusal !== undefined && (
        <p
          role="alert"
          className="basis-full text-(length:--text-meta) leading-(--leading-meta) text-state-error"
        >
          {refusal}
        </p>
      )}
      {back !== undefined && <div className="mr-auto">{back}</div>}
      {reason !== undefined && (
        <span
          id={reason.id}
          className="mr-auto text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
        >
          {reason.text}
        </span>
      )}
      {children}
    </div>
  );
}

export type DialogCancelProps = Omit<ButtonBaseProps, "variant" | "children"> &
  ButtonLoading & { children?: ReactNode };

/** DialogCancel is the secondary Cancel of a footer: it closes the dialog, and an alert opens on it. */
export function DialogCancel({ children = "Cancel", ...props }: DialogCancelProps) {
  return <UIDialogClose data-dialog-cancel="" render={<Button {...props}>{children}</Button>} />;
}
