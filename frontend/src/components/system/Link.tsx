import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { Spinner } from "./Spinner";

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> {
  href: string;
  external?: boolean;
  unavailable?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  error?: string;
  className?: string;
}

/**
 * LINK is the look of a link: the brand ink with its underline always on. An action written inline in
 * a line of text, like Try again in a note, is a button with this look.
 */
export const LINK =
  "inline-flex items-center gap-(--space-0-5) rounded-xs text-brand-ink underline decoration-[color-mix(in_srgb,currentColor_var(--mix-link-line),transparent)] decoration-(length:--border) underline-offset-(--link-offset) hover:decoration-current focus-visible:focus-ring active:text-brand-active";

/**
 * Link is a text link to a destination; the caller owns the click, since nothing navigates inside
 * the webview. An action without a destination is a Button.
 */
export function Link({
  external,
  unavailable,
  loading,
  loadingLabel,
  error,
  className,
  children,
  ...props
}: LinkProps) {
  if (unavailable) return <span className={cn("text-ink-4", className)}>{children}</span>;
  if (loading) {
    return (
      <span aria-busy="true" className={cn("inline-flex items-center gap-1.5", className)}>
        <Spinner tone="current" />
        {loadingLabel}
      </span>
    );
  }
  return (
    <>
      <a className={cn(LINK, className)} {...props}>
        {children}
        {external && <Icon icon={ICONS.external} size="xs" />}
      </a>
      {error !== undefined && (
        <span className="ml-1.5 text-state-error">
          <span aria-hidden="true">✕</span> {error}
        </span>
      )}
    </>
  );
}
