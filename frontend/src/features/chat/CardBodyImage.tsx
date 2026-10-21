import { useState } from "react";
import { ImageViewer } from "@/components/system/ImageViewer";
import { ImageMarker } from "@/features/chat/ImageMarker";
import { cardBodyImageUrl } from "@/lib/images";

export interface CardBodyImageProps {
  src?: string | undefined;
  alt?: string | undefined;
  /** issue is the card issue the body belongs to, owner/name#number. */
  issue: string;
}

/** CardBodyImage is an image of the body of a card, loaded through the product; a click opens it large. */
export function CardBodyImage({ src, alt, issue }: CardBodyImageProps) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const text = alt ?? "";
  if (src === undefined || src === "" || failed) {
    return <ImageMarker src={src} alt={alt} />;
  }
  const url = cardBodyImageUrl(issue, src);

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
