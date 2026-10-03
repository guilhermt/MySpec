import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExternalLink } from "@/features/chat/ExternalLink";
import { Markdown } from "@/features/chat/Markdown";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";

describe("Markdown", () => {
  it("renders what the agent wrote", () => {
    renderWithStore(<Markdown>## A heading</Markdown>);

    expect(screen.getByTestId("markdown")).toHaveTextContent("## A heading");
  });

  it("keeps rendering while the text still grows", () => {
    renderWithStore(<Markdown streaming>Half a sen</Markdown>);

    expect(screen.getByTestId("markdown")).toHaveTextContent("Half a sen");
  });

  it("reads in the reading register, on the measure of the conversation", () => {
    renderWithStore(<Markdown>Some text</Markdown>);

    expect(screen.getByTestId("markdown")).toHaveClass(
      "text-(length:--text-body)",
      "leading-(--leading-body)",
      "text-ink-1",
      "max-w-(--measure-conversation)",
    );
  });

  it("highlights code with the system's pair of code themes", () => {
    renderWithStore(<Markdown>Some text</Markdown>);

    expect(screen.getByTestId("markdown")).toHaveAttribute(
      "data-shiki-theme",
      "myspec-light myspec-dark",
    );
  });
});

describe("Markdown renderInlineCode", () => {
  const draw = (code: string) =>
    code.startsWith("{{") ? <span data-testid="drawn">{code}</span> : null;

  it("draws the inline code it answers for and leaves the rest as code", () => {
    renderWithStore(
      <Markdown renderInlineCode={draw}>{"Fill `{{task_name}}` and run `ls`."}</Markdown>,
    );

    expect(screen.getByTestId("drawn")).toHaveTextContent("{{task_name}}");
    expect(screen.getByText("ls").tagName).toBe("CODE");
    expect(screen.getByText("ls")).toHaveAttribute("data-streamdown", "inline-code");
  });

  it("leaves every inline code as it is without the prop", () => {
    renderWithStore(<Markdown>{"Fill `{{task_name}}`."}</Markdown>);

    expect(screen.queryByTestId("drawn")).not.toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent("Fill `{{task_name}}`.");
  });
});

describe("ExternalLink", () => {
  it("opens the link in the browser instead of the webview", async () => {
    const { user } = renderWithStore(
      <ExternalLink href="https://example.com">Example</ExternalLink>,
    );

    await user.click(screen.getByRole("link", { name: "Example" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://example.com");
  });

  it("swallows a click on a link that goes nowhere", async () => {
    const { user } = renderWithStore(<ExternalLink>Example</ExternalLink>);

    await user.click(screen.getByRole("link", { name: "Example" }));

    expect(api.openExternal).not.toHaveBeenCalled();
  });

  it("writes code without line numbers", () => {
    renderWithStore(<Markdown>Some text</Markdown>);

    expect(screen.getByTestId("markdown")).toHaveAttribute("data-line-numbers", "false");
  });

  it("cuts a long code block of the conversation to its first 20 lines, with the rest a click away", async () => {
    const code = Array.from({ length: 46 }, (_, at) => `line ${at + 1}`).join("\n");
    const { user } = renderWithStore(
      <Markdown cutCode>{`Intro\n\n\`\`\`\n${code}\n\`\`\``}</Markdown>,
    );

    const show = screen.getByRole("button", { name: "Show all 46 lines" });
    expect(show).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("26 more")).toBeInTheDocument();
    expect(await screen.findByText(/line 20/)).toBeInTheDocument();
    expect(screen.queryByText(/line 21/)).not.toBeInTheDocument();

    await user.click(show);

    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(await screen.findByText(/line 46/)).toBeInTheDocument();
    expect(screen.queryByText("26 more")).not.toBeInTheDocument();
  });

  it("copies a cut block whole, not the lines it shows, with its own Copy", async () => {
    const code = Array.from({ length: 46 }, (_, at) => `line ${at + 1}`).join("\n");
    const { user } = renderWithStore(
      <Markdown cutCode>{`Intro\n\n\`\`\`go\n${code}\n\`\`\``}</Markdown>,
    );
    const [intro, block] = screen.getAllByTestId("markdown");
    expect(intro).toHaveAttribute("data-code-copy", "true");
    expect(block).toHaveAttribute("data-code-copy", "false");

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await navigator.clipboard.readText()).toBe(code);
    const copied = screen.getByRole("button", { name: "Copied" });
    expect(copied.querySelector("svg.lucide-check")).toHaveAttribute("aria-hidden", "true");
  });

  it("puts Copy of a cut block and Show all at its foot inside the block", () => {
    const code = Array.from({ length: 30 }, (_, at) => `line ${at + 1}`).join("\n");
    renderWithStore(<Markdown cutCode>{`\`\`\`\n${code}\n\`\`\``}</Markdown>);

    const block = screen.getByTestId("markdown").parentElement;
    expect(block).toHaveAttribute("data-code-cut");
    expect(block).toContainElement(screen.getByRole("button", { name: "Copy" }));
    expect(block?.lastElementChild).toContainElement(
      screen.getByRole("button", { name: "Show all 30 lines" }),
    );
  });

  it("says in place when the copy failed, and how to copy instead", async () => {
    const code = Array.from({ length: 30 }, (_, at) => `line ${at + 1}`).join("\n");
    const { user } = renderWithStore(<Markdown cutCode>{`\`\`\`\n${code}\n\`\`\``}</Markdown>);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(
      await screen.findByRole("button", { name: "Can't copy · select the text" }),
    ).toBeInTheDocument();
  });

  it("leaves code whole out of the conversation", () => {
    const code = Array.from({ length: 46 }, (_, at) => `line ${at + 1}`).join("\n");
    renderWithStore(<Markdown>{`\`\`\`\n${code}\n\`\`\``}</Markdown>);

    expect(screen.queryByRole("button", { name: /Show all/ })).not.toBeInTheDocument();
  });

  it("draws the rail of a question in text beside the last block", () => {
    renderWithStore(<Markdown railLast>{"Which one?\n\na) This\nb) That"}</Markdown>);

    expect(screen.getByTestId("markdown")).toHaveClass("markdown-rail-last");
  });
});
