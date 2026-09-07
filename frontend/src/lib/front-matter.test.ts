import { describe, expect, it } from "vitest";
import { splitFrontMatter } from "@/lib/front-matter";

describe("splitFrontMatter", () => {
  it("reads the fields of a header and keeps the rest as body", () => {
    const { fields, body } = splitFrontMatter("---\nrepository: web\n---\n# Step 1: Log in\n");

    expect(fields).toEqual({ repository: "web" });
    expect(body).toBe("# Step 1: Log in\n");
  });

  it("takes a value out of its quotes or backticks", () => {
    const { fields } = splitFrontMatter("---\na: \"web\"\nb: 'api'\nc: `apps/web`\n---\n");

    expect(fields).toEqual({ a: "web", b: "api", c: "apps/web" });
  });

  it("keeps everything after the first colon of a line", () => {
    const { fields } = splitFrontMatter("---\ntitle: Log in: at last\n---\n");

    expect(fields.title).toBe("Log in: at last");
  });

  it("ignores the lines of the header that carry no field", () => {
    const { fields } = splitFrontMatter("---\nrepository: web\nnonsense\n---\n");

    expect(fields).toEqual({ repository: "web" });
  });

  it("gives content without a header no fields at all", () => {
    const content = "# Step 1: Log in\n";

    expect(splitFrontMatter(content)).toEqual({ fields: {}, body: content });
  });

  it("gives content with an unclosed header no fields at all", () => {
    const content = "---\nrepository: web\n# Step 1\n";

    expect(splitFrontMatter(content)).toEqual({ fields: {}, body: content });
  });

  it("reads a header written with carriage returns", () => {
    const { fields, body } = splitFrontMatter("---\r\nrepository: web\r\n---\r\n# Step 1\r\n");

    expect(fields).toEqual({ repository: "web" });
    expect(body).toBe("# Step 1\n");
  });
});
