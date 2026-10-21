import { useState } from "react";
import { ImageStrip } from "@/components/system/ImageStrip";
import { ImageThumb } from "@/components/system/ImageThumb";
import { ImageViewer } from "@/components/system/ImageViewer";
import { type Attachment, imageCaption, imageTitle } from "@/lib/images";
import type { CardImage } from "@/lib/wails";

export interface ContextImagesProps {
  /** read are the images read from the cards. */
  read: CardImage[];
  /** attached are the images the user attached to their own text. */
  attached: Attachment[];
}

interface Shown {
  key: string;
  src: string;
  alt: string;
  caption: string;
  title: string;
}

/** ContextImages is the Images section of the context shown on request: the cards' and the user's. */
export function ContextImages({ read, attached }: ContextImagesProps) {
  const [opened, setOpened] = useState<string | null>(null);
  const shown: Shown[] = [
    ...read.map((image) => ({
      key: image.id,
      src: image.url,
      alt: image.alt,
      caption: imageCaption(image),
      title: imageTitle(image),
    })),
    ...attached.map((attachment) => ({
      key: attachment.id,
      src: attachment.url,
      alt: attachment.name,
      caption: imageCaption({ origin: "user", number: 0 }),
      title: attachment.name,
    })),
  ];
  const viewing = shown.find((image) => image.key === opened);
  return (
    <div className="flex flex-col gap-(--space-2)">
      <span className="text-(length:--text-meta) leading-(--leading-meta) font-semibold text-ink-2">
        Images
      </span>
      <ImageStrip label="Images">
        {shown.map((image, at) => (
          <ImageThumb
            key={image.key}
            src={image.src}
            label={`Image ${at + 1} of ${shown.length}, ${image.alt === "" ? image.caption : image.alt}`}
            size="md"
            caption={image.caption}
            onOpen={() => setOpened(image.key)}
          />
        ))}
      </ImageStrip>
      <ImageViewer
        open={viewing !== undefined}
        onOpenChange={(open) => !open && setOpened(null)}
        title={viewing?.title ?? ""}
        src={viewing?.src ?? ""}
        alt={viewing?.alt ?? ""}
      />
    </div>
  );
}
