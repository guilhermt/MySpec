import { describe, expect, it } from "vitest";
import {
  type Attachment,
  cardBodyImageUrl,
  draftImageUrl,
  encodeImages,
  failureLine,
  guardFileDrops,
  imageCaption,
  imageFiles,
  imagesCount,
  imagesPart,
  imageTitle,
  isRemoteImage,
  MAX_CARD_IMAGE_BYTES,
  MAX_IMAGE_BYTES,
  readAttachments,
  refusalText,
  revokeAttachments,
  sniffImage,
} from "@/lib/images";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];

function file(name: string, bytes: readonly number[], type = ""): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("sniffImage", () => {
  it.each([
    ["PNG", PNG, "image/png"],
    ["JPEG", [0xff, 0xd8, 0xff, 0xe0], "image/jpeg"],
    ["GIF87a", [...Buffer.from("GIF87a")], "image/gif"],
    ["GIF89a", [...Buffer.from("GIF89a")], "image/gif"],
    ["WebP", [...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WEBP")], "image/webp"],
    ["BMP", [...Buffer.from("BM"), 0, 0, 0, 0], null],
    ["WAV", [...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WAVE")], null],
    ["PDF", [...Buffer.from("%PDF-1.7")], null],
    ["a few bytes", [0x89, 0x50], null],
    ["nothing", [], null],
  ])("tells %s", (_name, bytes, want) => {
    expect(sniffImage(new Uint8Array(bytes))).toBe(want);
  });
});

describe("readAttachments", () => {
  it("attaches the images in order, naming a paste without a name", async () => {
    const { attachments, refusals } = await readAttachments([
      file("a.png", PNG),
      file("", [0xff, 0xd8, 0xff, 0xe0]),
    ]);
    expect(refusals).toEqual([]);
    expect(attachments.map((one) => [one.name, one.mediaType])).toEqual([
      ["a.png", "image/png"],
      ["pasted image", "image/jpeg"],
    ]);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });

  it("refuses by the bytes, not by the name", async () => {
    const { attachments, refusals } = await readAttachments([
      file("diagram.png", [...Buffer.from("BM"), 0, 0]),
      file("ok.png", PNG),
    ]);
    expect(refusals).toEqual([{ name: "diagram.png", reason: "format" }]);
    expect(attachments.map((one) => one.name)).toEqual(["ok.png"]);
  });

  it("refuses an image over the limit before reading it", async () => {
    const big = file("print.png", PNG);
    Object.defineProperty(big, "size", { value: MAX_IMAGE_BYTES + 1 });
    const { attachments, refusals } = await readAttachments([big]);
    expect(attachments).toEqual([]);
    expect(refusals).toEqual([{ name: "print.png", reason: "size" }]);
  });
});

describe("readAttachments with another limit", () => {
  it("refuses what is over the limit it is given", async () => {
    const big = file("big.png", PNG);
    Object.defineProperty(big, "size", { value: MAX_CARD_IMAGE_BYTES + 1 });
    const fits = file("fits.png", PNG);
    Object.defineProperty(fits, "size", { value: MAX_CARD_IMAGE_BYTES });

    const { attachments, refusals } = await readAttachments([big, fits], MAX_CARD_IMAGE_BYTES);

    expect(refusals).toEqual([{ name: "big.png", reason: "size" }]);
    expect(attachments.map((one) => one.name)).toEqual(["fits.png"]);
  });
});

describe("refusalText", () => {
  it("names the limit it is given", () => {
    expect(refusalText([{ name: "big.png", reason: "size" }], 10)).toBe(
      "Not attached · big.png is over 10 MB",
    );
  });

  it("says each reason after a single lead", () => {
    expect(refusalText([{ name: "print.png", reason: "size" }])).toBe(
      "Not attached · print.png is over 20 MB",
    );
    expect(
      refusalText([
        { name: "diagram.bmp", reason: "format" },
        { name: "b.png", reason: "size" },
      ]),
    ).toBe("Not attached · diagram.bmp isn't PNG, JPEG, GIF or WebP · b.png is over 20 MB");
  });
});

describe("attachments", () => {
  it("encodes in base64 without the prefix and revokes the URLs", async () => {
    const one: Attachment = {
      id: "1",
      name: "a.png",
      mediaType: "image/png",
      blob: new Blob([new Uint8Array([1, 2, 3])]),
      url: "blob:one",
    };
    expect(await encodeImages([one])).toEqual(["AQID"]);
    revokeAttachments([one]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one");
  });

  it("lists the files of a transfer", () => {
    const a = file("a.png", PNG);
    expect(imageFiles({ files: [a] } as unknown as DataTransfer)).toEqual([a]);
  });
});

describe("texts", () => {
  it("counts images", () => {
    expect(imagesCount(1)).toBe("1 image");
    expect(imagesCount(3)).toBe("3 images");
  });

  it("adds the images to a line", () => {
    expect(imagesPart(0, false)).toBe("");
    expect(imagesPart(3, false)).toBe(" · 3 images");
    expect(imagesPart(3, true)).toBe(" · reading images…");
  });

  it("captions and titles by origin", () => {
    expect(imageCaption({ origin: "card", number: 474 })).toBe("Card #474");
    expect(imageCaption({ origin: "epic", number: 470 })).toBe("Epic #470");
    expect(imageCaption({ origin: "user", number: 0 })).toBe("Your text");
    expect(imageTitle({ origin: "card", number: 474 })).toBe("From the card #474");
    expect(imageTitle({ origin: "epic", number: 470 })).toBe("From the epic #470");
    expect(imageTitle({ origin: "user", number: 0 })).toBe("From your text");
    expect(imageCaption({ origin: "draft", number: 0 })).toBe("Your edit");
    expect(imageTitle({ origin: "draft", number: 0 })).toBe("From your edit of a draft");
  });

  it("writes a failure of the body, of an image with alt and of one without", () => {
    const base = { origin: "card", issue: "o/r#474", number: 474, url: "", alt: "", reason: "" };
    expect(failureLine({ ...base, reason: "gh isn't signed in" })).toBe(
      "The images of the card #474 couldn't be read: gh isn't signed in.",
    );
    expect(
      failureLine({
        ...base,
        origin: "epic",
        number: 470,
        url: "https://x/y.png",
        alt: "Logo",
        reason: "it's over 20 MB",
      }),
    ).toBe(`The image "Logo" of the epic #470 couldn't be read: it's over 20 MB.`);
    expect(
      failureLine({ ...base, url: "https://x/y.png", reason: "the server answered 404" }),
    ).toBe("An image of the card #474 couldn't be read: the server answered 404.");
    expect(failureLine({ ...base, origin: "", issue: "", number: 0, reason: "boom" })).toBe(
      "The images of the cards couldn't be read: boom.",
    );
  });

  it("builds the URL of a body image", () => {
    expect(cardBodyImageUrl("o/r#4", "https://x/a b.png")).toBe(
      "/myspec/card-images/body?issue=o%2Fr%234&src=https%3A%2F%2Fx%2Fa%20b.png",
    );
  });
});

describe("isRemoteImage", () => {
  it("tells a link from a path", () => {
    expect(isRemoteImage("https://x/a.png")).toBe(true);
    expect(isRemoteImage("//host/a.png")).toBe(true);
    expect(isRemoteImage("images/a.png")).toBe(false);
    expect(isRemoteImage("foo.png")).toBe(false);
    expect(isRemoteImage("C:\\x.png")).toBe(false);
  });
});

describe("draftImageUrl", () => {
  const FILE = "0b6c3c1e-2f8a-4c7e-9b1d-2a4f5e6d7c8b.png";

  it("loads a reference of the discussion, with or without the leading dot", () => {
    expect(draftImageUrl("d-1", null, `images/${FILE}`)).toBe(`/myspec/images/d-1/${FILE}`);
    expect(draftImageUrl("d-1", "o/r#4", `./images/${FILE}`)).toBe(`/myspec/images/d-1/${FILE}`);
  });

  it("loads a link through the card of an update, and draws it as it is without one", () => {
    expect(draftImageUrl("d-1", "o/r#4", "https://x/a.png")).toBe(
      cardBodyImageUrl("o/r#4", "https://x/a.png"),
    );
    expect(draftImageUrl("d-1", null, "https://x/a.png")).toBe("https://x/a.png");
  });

  it("has nothing for any other path", () => {
    expect(draftImageUrl("d-1", null, "images/x.png")).toBeNull();
    expect(draftImageUrl("d-1", null, `../images/${FILE}`)).toBeNull();
    expect(draftImageUrl("d-1", null, "")).toBeNull();
  });
});

describe("guardFileDrops", () => {
  const dragOf = (type: string, types: string[]) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { types } });
    return event;
  };

  it("prevents the drag and the drop of files, and only those", () => {
    const stop = guardFileDrops(window);
    const files = dragOf("dragover", ["Files"]);
    const drop = dragOf("drop", ["Files"]);
    const text = dragOf("drop", ["text/plain"]);
    window.dispatchEvent(files);
    window.dispatchEvent(drop);
    window.dispatchEvent(text);
    expect(files.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
    expect(text.defaultPrevented).toBe(false);
    stop();
  });

  it("stops guarding when removed", () => {
    const stop = guardFileDrops(window);
    stop();
    const drop = dragOf("drop", ["Files"]);
    window.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(false);
  });
});
