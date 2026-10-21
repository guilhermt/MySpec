import { Dialog } from "./Dialog";

export interface ImageViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  src: string;
  alt: string;
}

/** ImageViewer shows an image large in the full dialog, whole and centered, with no scrolling. */
export function ImageViewer({ open, onOpenChange, title, src, alt }: ImageViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} size="full">
      <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-0 p-(--space-4)">
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      </div>
    </Dialog>
  );
}
