import { type DragEvent, useState } from "react";
import { carriesFiles, imageFiles } from "@/lib/images";

export interface ImageDrop {
  /** dragging says files are over the target. */
  dragging: boolean;
  handlers: {
    onDragEnter: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
}

/**
 * useImageDrop makes a target take the files dropped on it, all of them, so that one that isn't an
 * image is refused by its format. Disabled, it does nothing.
 */
export function useImageDrop(onFiles: (files: File[]) => void, enabled: boolean): ImageDrop {
  // depth counts the enters and leaves, which the children of the target would make blink.
  const [depth, setDepth] = useState(0);
  const active = (event: DragEvent) => enabled && carriesFiles(event);

  return {
    dragging: enabled && depth > 0,
    handlers: {
      onDragEnter: (event) => {
        if (active(event)) {
          event.preventDefault();
          setDepth((count) => count + 1);
        }
      },
      onDragOver: (event) => {
        if (active(event)) {
          event.preventDefault();
        }
      },
      onDragLeave: (event) => {
        if (active(event)) {
          setDepth((count) => Math.max(count - 1, 0));
        }
      },
      onDrop: (event) => {
        if (!active(event)) {
          return;
        }
        event.preventDefault();
        setDepth(0);
        onFiles(imageFiles(event.dataTransfer));
      },
    },
  };
}
