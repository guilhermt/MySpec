import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
