import type { ClipboardEvent } from "react";

/**
 * pasteImages hands the images of a paste to onFiles and keeps them out of the field. A paste with
 * none goes on as text.
 */
export function pasteImages(
  event: ClipboardEvent<HTMLTextAreaElement>,
  onFiles: (files: File[]) => void,
): void {
  const images = Array.from(event.clipboardData.files).filter((file) =>
    file.type.startsWith("image/"),
  );
  if (images.length > 0) {
    event.preventDefault();
    onFiles(images);
  }
}
