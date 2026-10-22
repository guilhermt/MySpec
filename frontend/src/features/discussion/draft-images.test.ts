import { describe, expect, it } from "vitest";
import {
  altOf,
  bodyImages,
  imageReference,
  readableImages,
  removeImage,
} from "@/features/discussion/draft-images";

describe("bodyImages", () => {
  it("lists the images once per destination, in the order they first appear", () => {
    const text = "![a](images/1.png) text ![b](https://x/y.png)\n![again](images/1.png)";

    expect(bodyImages(text)).toEqual([
      { src: "images/1.png", alt: "a" },
      { src: "https://x/y.png", alt: "b" },
    ]);
  });

  it("reads an empty alt, a title and an escaped bracket", () => {
    expect(bodyImages('![](a.png) ![x \\] y](b.png "title")')).toEqual([
      { src: "a.png", alt: "" },
      { src: "b.png", alt: "x ] y" },
    ]);
  });

  it("finds none in a text without images", () => {
    expect(bodyImages("a [link](x) and text")).toEqual([]);
  });
});

describe("removeImage", () => {
  it("takes out every image with the destination, and the line left empty", () => {
    const text = "One\n![a](images/1.png)\nTwo ![b](images/1.png) end\n![c](images/2.png)";

    expect(removeImage(text, "images/1.png")).toBe("One\nTwo  end\n![c](images/2.png)");
  });

  it("keeps the empty lines that were already there", () => {
    expect(removeImage("One\n\nTwo", "images/1.png")).toBe("One\n\nTwo");
  });
});

describe("readableImages", () => {
  it("writes an image as its alt, or as Image without one", () => {
    expect(readableImages("see ![Print](images/1.png) and ![](images/2.png)")).toBe(
      "see [Image: Print] and [Image]",
    );
  });
});

describe("imageReference", () => {
  it("writes the Markdown of an image, escaping ] and \\ of the alt", () => {
    expect(imageReference("shot", "images/1.png")).toBe("![shot](images/1.png)");
    expect(imageReference("a]b\\c", "images/1.png")).toBe("![a\\]b\\\\c](images/1.png)");
  });

  it("round-trips through bodyImages", () => {
    expect(bodyImages(imageReference("a]b\\c", "images/1.png"))).toEqual([
      { src: "images/1.png", alt: "a]b\\c" },
    ]);
  });
});

describe("altOf", () => {
  it("is the name without the extension, and Image for a paste without a name", () => {
    expect(altOf("shot.png")).toBe("shot");
    expect(altOf("my.shot.final.png")).toBe("my.shot.final");
    expect(altOf("noext")).toBe("noext");
    expect(altOf("pasted image")).toBe("Image");
    expect(altOf("")).toBe("Image");
  });
});
