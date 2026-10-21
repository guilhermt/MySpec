import { useState } from "react";
import { ImageStrip } from "@/components/system/ImageStrip";
import { ImageThumb } from "@/components/system/ImageThumb";
import { ImageViewer } from "@/components/system/ImageViewer";
import type { Attachment } from "@/lib/images";

export interface AttachedImagesProps {
  attachments: Attachment[];
  /** onRemove draws the × of each image; without it the images stay, while a dialog creates. */
  onRemove?: (id: string) => void;
}

/** AttachedImages are the images attached to what is being written, each opening large. */
export function AttachedImages({ attachments, onRemove }: AttachedImagesProps) {
  const [opened, setOpened] = useState<string | null>(null);
  const viewing = attachments.find((one) => one.id === opened);
  return (
    <>
      <ImageStrip label="Attached images">
        {attachments.map((attachment, at) => (
          <ImageThumb
            key={attachment.id}
            src={attachment.url}
            label={`Image ${at + 1} of ${attachments.length}, ${attachment.name}`}
            size="sm"
            onOpen={() => setOpened(attachment.id)}
            {...(onRemove !== undefined
              ? {
                  onRemove: () => onRemove(attachment.id),
                  removeLabel: `Remove image ${at + 1}, ${attachment.name}`,
                }
              : {})}
          />
        ))}
      </ImageStrip>
      <ImageViewer
        open={viewing !== undefined}
        onOpenChange={(open) => !open && setOpened(null)}
        title={viewing?.name ?? ""}
        src={viewing?.url ?? ""}
        alt={viewing?.name ?? ""}
      />
    </>
  );
}
