import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
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
import { CutText } from "./CutText";
import { IconButton } from "./IconButton";
import { ICONS } from "./icons";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  size?: "default" | "wide";
  alert?: boolean;
  onConfirm?: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  /** closeDisabled draws the × disabled, while the dialog waits for a call. */
  closeDisabled?: boolean;
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
 * While the dialog waits for a call, closeDisabled and a disabled DialogCancel draw the ways out
 * dashed, and its onOpenChange ignores the close.
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
  closeDisabled = false,
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
      closeDisabled={closeDisabled}
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
  closeDisabled,
}: {
  title: string;
  subtitle?: string;
  alert: boolean;
  closeDisabled: boolean;
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
      <Close
        render={
          <IconButton
            label="Close"
            shortcut="Esc"
            icon={ICONS.close}
            size="sm"
            disabled={closeDisabled}
          />
        }
      />
    </div>
  );
}

/** CANCEL finds the DialogCancel of a dialog, where an alert opens. */
const CANCEL = "[data-dialog-cancel]";

/**
 * FIELD finds the first field of a dialog body that takes the focus, where the others open. A
 * disabled field of the system stays focusable with aria-disabled, so both kinds are left out.
 */
const FIELD =
  '[data-dialog-body] :is(input:not([type=hidden]), textarea, select, [role=combobox]):not(:disabled):not([aria-disabled="true"])';

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
  /** reason is what holds the primary back or what confirming does; lines 2 lets a long one wrap once. */
  reason?: { id: string; text: string; lines?: 1 | 2 };
  refusal?: string;
}

/**
 * DialogFooter holds the refusal above, and on one line Back or the disabled reason on the left and
 * Cancel and the confirmation on the right. The buttons never wrap nor move: the reason takes the
 * space left, on one line or two, and is cut, with its whole text in a tooltip.
 */
export function DialogFooter({ children, back, reason, refusal }: DialogFooterProps) {
  return (
    <div
      data-dialog-footer=""
      className="flex flex-col gap-2 bg-surface-0 px-5 py-3 shadow-[inset_0_var(--border)_0_var(--line-1)]"
    >
      {refusal !== undefined && (
        <p
          role="alert"
          className="text-(length:--text-meta) leading-(--leading-meta) text-state-error"
        >
          {refusal}
        </p>
      )}
      <div className="flex items-center gap-2">
        {back !== undefined && <div className="shrink-0">{back}</div>}
        {reason !== undefined && (
          <CutText
            id={reason.id}
            text={reason.text}
            lines={reason.lines ?? 1}
            className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
          />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

export type DialogCancelProps = Omit<ButtonBaseProps, "variant" | "children"> &
  ButtonLoading & { children?: ReactNode };

/** DialogCancel is the ghost Cancel of a footer: it closes the dialog, and an alert opens on it. */
export function DialogCancel({ children = "Cancel", ...props }: DialogCancelProps) {
  return (
    <UIDialogClose
      data-dialog-cancel=""
      render={
        <Button variant="ghost" {...props}>
          {children}
        </Button>
      }
    />
  );
}
