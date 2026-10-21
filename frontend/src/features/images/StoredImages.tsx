import { useState } from "react";
import { ImageStrip } from "@/components/system/ImageStrip";
import { ImageThumb } from "@/components/system/ImageThumb";
import { ImageViewer } from "@/components/system/ImageViewer";
import { imageCaption, imageTitle } from "@/lib/images";
import type { Image } from "@/lib/wails";

export interface StoredImagesProps {
  images: Image[];
  size: "sm" | "md";
  /** captions says where each image comes from, under it and in its large title. */
  captions: boolean;
}

// labelOf names an image by its place in the list, and by its alt when it has one.
function labelOf(image: Image, at: number, count: number): string {
  const place = `Image ${at + 1} of ${count}`;
  return image.alt === "" ? place : `${place}, ${image.alt}`;
}

/** StoredImages are the images kept with a conversation, each opening large. */
export function StoredImages({ images, size, captions }: StoredImagesProps) {
  const [opened, setOpened] = useState<number | null>(null);
  const viewing = opened === null ? undefined : images[opened];
  return (
    <>
      <ImageStrip label="Images">
        {images.map((image, at) => (
          <ImageThumb
            key={image.id}
            src={image.url}
            label={labelOf(image, at, images.length)}
            size={size}
            {...(captions ? { caption: imageCaption(image) } : {})}
            onOpen={() => setOpened(at)}
          />
        ))}
      </ImageStrip>
      <ImageViewer
        open={viewing !== undefined}
        onOpenChange={(open) => !open && setOpened(null)}
        title={
          viewing === undefined
            ? ""
            : captions
              ? imageTitle(viewing)
              : labelOf(viewing, opened ?? 0, images.length)
        }
        src={viewing?.url ?? ""}
        alt={viewing?.alt ?? ""}
      />
    </>
  );
}
