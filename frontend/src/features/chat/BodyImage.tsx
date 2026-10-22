import { useState } from "react";
import { ImageViewer } from "@/components/system/ImageViewer";
import { ImageMarker } from "@/features/chat/ImageMarker";
import { isRemoteImage } from "@/lib/images";

export interface BodyImageProps {
  src?: string | undefined;
  alt?: string | undefined;
  /** url is where the webview loads it; null draws the marker. */
  url: string | null;
}

/** BodyImage is an image of a body, loaded through the product; a click opens it large. */
export function BodyImage({ src, alt, url }: BodyImageProps) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const text = alt ?? "";
  if (url === null || failed) {
    // The marker links only a remote image, never a path of the discussion.
    return (
      <ImageMarker src={src !== undefined && isRemoteImage(src) ? src : undefined} alt={alt} />
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={text !== "" ? `Open the image ${text}` : "Open the image"}
        onClick={() => setOpen(true)}
        className="inline-block max-w-full cursor-zoom-in"
      >
        <img
          src={url}
          alt={text}
          loading="lazy"
          onError={() => setFailed(true)}
          className="max-w-full rounded-md"
        />
      </button>
      <ImageViewer
        open={open}
        onOpenChange={setOpen}
        title={text || "Image"}
        src={url}
        alt={text}
      />
    </>
  );
}
