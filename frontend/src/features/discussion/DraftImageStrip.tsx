import { useState } from "react";
import { ImageStrip } from "@/components/system/ImageStrip";
import { ImageThumb } from "@/components/system/ImageThumb";
import { ImageViewer } from "@/components/system/ImageViewer";
import { bodyImages } from "@/features/discussion/draft-images";
import { draftImageUrl } from "@/lib/images";

export interface DraftImageStripProps {
  discussionId: string;
  /** issue is the card an update changes, owner/name#number; null otherwise. */
  issue: string | null;
  /** text is the body as it is being typed. */
  text: string;
  /** onRemove takes every reference to the image out of the body; without it, no ×. */
  onRemove?: (src: string) => void;
}

/** DraftImageStrip is the row of thumbnails of the images a body writes, each opening large. */
export function DraftImageStrip({ discussionId, issue, text, onRemove }: DraftImageStripProps) {
  const [opened, setOpened] = useState<string | null>(null);
  const images = bodyImages(text);
  if (images.length === 0) {
    return null;
  }
  const viewing = images.find((image) => image.src === opened);
  return (
    <>
      <ImageStrip label="Images of the body">
        {images.map((image, at) => (
          <ImageThumb
            key={image.src}
            src={draftImageUrl(discussionId, issue, image.src) ?? ""}
            label={`Image ${at + 1} of ${images.length}, ${image.alt === "" ? "no alternative text" : image.alt}`}
            size="sm"
            onOpen={() => setOpened(image.src)}
            {...(onRemove !== undefined
              ? {
                  onRemove: () => onRemove(image.src),
                  removeLabel: `Take image ${at + 1} out of the body, ${image.alt || "no alternative text"}`,
                }
              : {})}
          />
        ))}
      </ImageStrip>
      <ImageViewer
        open={viewing !== undefined}
        onOpenChange={(open) => !open && setOpened(null)}
        title={viewing === undefined ? "" : viewing.alt || "Image"}
        src={viewing === undefined ? "" : (draftImageUrl(discussionId, issue, viewing.src) ?? "")}
        alt={viewing?.alt ?? ""}
      />
    </>
  );
}
