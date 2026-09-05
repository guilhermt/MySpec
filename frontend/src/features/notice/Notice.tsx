import { TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { noticeMessage } from "@/features/notice/messages";
import { cn } from "@/lib/utils";
import type { NoticeReason } from "@/lib/wails";

interface BannerProps {
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  className?: string;
}

function Banner({ title, children, onDismiss, className }: BannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border bg-muted px-3 py-2 text-foreground",
        className,
      )}
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="break-words">{children}</p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="-mr-1 shrink-0"
      >
        <X />
      </Button>
    </div>
  );
}

export interface NoticeProps {
  path: string;
  reason: NoticeReason;
  onDismiss: () => void;
}

export function Notice({ path, reason, onDismiss }: NoticeProps) {
  const { before, path: shown, after } = noticeMessage(path, reason);

  return (
    <Banner title="Couldn't open folder" onDismiss={onDismiss}>
      {before}
      <span className="font-mono">{shown}</span>
      {after}
    </Banner>
  );
}

export interface ErrorNoticeProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorNotice({ message, onDismiss }: ErrorNoticeProps) {
  return (
    <Banner title="Something went wrong" onDismiss={onDismiss} className="bg-destructive/10">
      {message}
    </Banner>
  );
}
