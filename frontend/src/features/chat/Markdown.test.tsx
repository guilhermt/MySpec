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
});
