import type { CardImageFailure } from "@/lib/wails";

/** MAX_IMAGE_BYTES is images.MaxSize: the most an image may have. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

/** Attachment is an image attached and not yet sent. */
export interface Attachment {
  id: string;
  /** name is the file name; "pasted image" for a paste without one. */
  name: string;
  mediaType: ImageMediaType;
  blob: Blob;
  /** url is the object URL the thumbnail loads. */
  url: string;
}

/** Refusal is an image that wasn't attached, and why. */
export interface Refusal {
  name: string;
  reason: "format" | "size";
}

// The routes repeat ImagesRoute and CardImagesRoute of internal/bindings/images.go.
const CARD_IMAGES_ROUTE = "/myspec/card-images/";

const PASTED_NAME = "pasted image";

// startsWith says whether the head begins with the bytes, from the offset.
function startsWith(head: Uint8Array, bytes: readonly number[], at = 0): boolean {
  return bytes.every((byte, index) => head[at + index] === byte);
}

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));

/** sniffImage tells the format of an image from its first bytes, null when it isn't one the agent takes. */
export function sniffImage(head: Uint8Array): ImageMediaType | null {
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(head, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (startsWith(head, ascii("GIF87a")) || startsWith(head, ascii("GIF89a"))) {
    return "image/gif";
  }
  if (startsWith(head, ascii("RIFF")) && startsWith(head, ascii("WEBP"), 8)) {
    return "image/webp";
  }
  return null;
}

/** readAttachments turns files into attachments, in order, and names those it refuses. */
export async function readAttachments(
  files: readonly File[],
): Promise<{ attachments: Attachment[]; refusals: Refusal[] }> {
  const attachments: Attachment[] = [];
  const refusals: Refusal[] = [];
  for (const file of files) {
    const name = file.name === "" ? PASTED_NAME : file.name;
    if (file.size > MAX_IMAGE_BYTES) {
      refusals.push({ name, reason: "size" });
      continue;
    }
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const mediaType = sniffImage(head);
    if (mediaType === null) {
      refusals.push({ name, reason: "format" });
      continue;
    }
    attachments.push({
      id: crypto.randomUUID(),
      name,
      mediaType,
      blob: file,
      url: URL.createObjectURL(file),
    });
  }
  return { attachments, refusals };
}

/** refusalText is the line under the field for the images that weren't attached. */
export function refusalText(refusals: readonly Refusal[]): string {
  const each = refusals.map((refusal) =>
    refusal.reason === "size"
      ? `${refusal.name} is over 20 MB`
      : `${refusal.name} isn't PNG, JPEG, GIF or WebP`,
  );
  return `Not attached · ${each.join(" · ")}`;
}

// base64Of reads a blob as base64, without the data: prefix.
function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** encodeImages is the attachments in base64, in order, as the bindings take them. */
export function encodeImages(attachments: readonly Attachment[]): Promise<string[]> {
  return Promise.all(attachments.map((attachment) => base64Of(attachment.blob)));
}

/** revokeAttachments frees the object URLs of the attachments. */
export function revokeAttachments(attachments: readonly Attachment[]): void {
  for (const attachment of attachments) {
    URL.revokeObjectURL(attachment.url);
  }
}

/** imageFiles are the files of a paste or of a drag. */
export function imageFiles(transfer: DataTransfer): File[] {
  return Array.from(transfer.files);
}

/** imagesCount is "1 image", "3 images". */
export function imagesCount(n: number): string {
  return `${n} ${n === 1 ? "image" : "images"}`;
}

/** imagesPart is what a line of context adds about its images: " · reading images…", " · 3 images", "". */
export function imagesPart(count: number, reading: boolean): string {
  if (reading) {
    return " · reading images…";
  }
  return count > 0 ? ` · ${imagesCount(count)}` : "";
}

/** imageCaption is the short label under a thumbnail: "Card #474", "Epic #470", "Your text". */
export function imageCaption(image: { origin: string; number: number }): string {
  switch (image.origin) {
    case "card":
      return `Card #${image.number}`;
    case "epic":
      return `Epic #${image.number}`;
    default:
      return "Your text";
  }
}

/** imageTitle is the title of the large image: "From the card #474", "From your text". */
export function imageTitle(image: { origin: string; number: number }): string {
  switch (image.origin) {
    case "card":
      return `From the card #${image.number}`;
    case "epic":
      return `From the epic #${image.number}`;
    default:
      return "From your text";
  }
}

// ownerOf names the card or epic a failure is about; the cards when it names none.
function ownerOf(failure: CardImageFailure): string {
  if (failure.number === 0) {
    return "the cards";
  }
  return `the ${failure.origin === "epic" ? "epic" : "card"} #${failure.number}`;
}

/** failureLine is the line that says an image, or the images of a body, couldn't be read. */
export function failureLine(failure: CardImageFailure): string {
  const owner = ownerOf(failure);
  if (failure.url === "") {
    return `The images of ${owner} couldn't be read: ${failure.reason}.`;
  }
  const what = failure.alt === "" ? "An image" : `The image "${failure.alt}"`;
  return `${what} of ${owner} couldn't be read: ${failure.reason}.`;
}

/** cardBodyImageUrl is where the webview loads an image of the body of a card issue (owner/name#number). */
export function cardBodyImageUrl(issue: string, src: string): string {
  return `${CARD_IMAGES_ROUTE}body?issue=${encodeURIComponent(issue)}&src=${encodeURIComponent(src)}`;
}

// carriesFiles says whether a drag brings files.
function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/**
 * guardFileDrops keeps a file dropped outside a field from navigating the webview to it. It returns
 * the function that removes the guard.
 */
export function guardFileDrops(target: Window): () => void {
  const guard = (event: DragEvent) => {
    if (carriesFiles(event)) {
      event.preventDefault();
    }
  };
  target.addEventListener("dragover", guard);
  target.addEventListener("drop", guard);
  return () => {
    target.removeEventListener("dragover", guard);
    target.removeEventListener("drop", guard);
  };
}
