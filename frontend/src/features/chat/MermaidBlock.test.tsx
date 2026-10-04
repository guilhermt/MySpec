import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "@/features/chat/Markdown";
import { MermaidBlock } from "@/features/chat/MermaidBlock";
import { renderWithStore } from "@/test/render";

const mermaid = vi.hoisted(() => ({
  render: vi.fn(),
  configs: [] as unknown[],
}));

vi.mock("@streamdown/mermaid", () => ({
  createMermaidPlugin: ({ config }: { config: unknown }) => ({
    getMermaid: () => {
      mermaid.configs.push(config);
      return { initialize: vi.fn(), render: mermaid.render };
    },
  }),
}));

const SVG = '<svg viewBox="0 0 400 200" width="100%" style="max-width: 400px"><g /></svg>';

beforeEach(() => {
  mermaid.render.mockReset();
  mermaid.configs.length = 0;
});

describe("MermaidBlock", () => {
  it("shows the code with the spinner until the block closes", () => {
    renderWithStore(<MermaidBlock source={"flowchart LR\n  a --> b"} closed={false} />);

    expect(screen.getByText("Drawing the diagram…")).toBeInTheDocument();
    expect(screen.getByText(/flowchart LR/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Full screen" })).not.toBeInTheDocument();
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it("draws the diagram at its natural size with the strict config", async () => {
    mermaid.render.mockResolvedValue({ svg: SVG });
    const { container } = renderWithStore(<MermaidBlock source="flowchart LR" closed />);

    expect(await screen.findByRole("button", { name: "Full screen" })).toBeInTheDocument();
    expect(screen.queryByText("Drawing the diagram…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy the code" })).toBeInTheDocument();
    const diagram = container.querySelector('svg[width="100%"]');
    expect(diagram).toHaveAttribute("width", "100%");
    expect(diagram?.parentElement).toHaveStyle({ width: "400px" });
    expect(mermaid.configs[0]).toMatchObject({
      theme: "neutral",
      fontFamily: "var(--font-ui)",
      securityLevel: "strict",
    });
  });

  it("says why it couldn't draw and keeps the code", async () => {
    mermaid.render.mockRejectedValue(new Error("Parse error on line 2"));
    renderWithStore(<MermaidBlock source="not a diagram" closed />);

    expect(await screen.findByText("Couldn't draw the diagram: Parse error on line 2")).toHaveClass(
      "text-state-error",
    );
    expect(screen.getByText("not a diagram")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Full screen" })).not.toBeInTheDocument();
  });

  it("zooms the full screen by width, from 0.5 to 3, and resets", async () => {
    const user = userEvent.setup();
    mermaid.render.mockResolvedValue({ svg: SVG });
    renderWithStore(<MermaidBlock source="flowchart LR" closed />);

    await user.click(await screen.findByRole("button", { name: "Full screen" }));
    const dialog = await screen.findByRole("dialog", { name: "Diagram" });
    const width = () => dialog.querySelector('svg[width="100%"]')?.parentElement as HTMLElement;
    expect(width()).toHaveStyle({ width: "400px" });

    await user.click(within(dialog).getByRole("button", { name: "Zoom in" }));
    expect(width()).toHaveStyle({ width: "500px" });
    await user.click(within(dialog).getByRole("button", { name: "Zoom out" }));
    await user.click(within(dialog).getByRole("button", { name: "Zoom out" }));
    expect(width()).toHaveStyle({ width: "300px" });
    expect(within(dialog).getByRole("button", { name: "Reset zoom" })).toBeEnabled();

    await user.click(within(dialog).getByRole("button", { name: "Reset zoom" }));
    expect(width()).toHaveStyle({ width: "400px" });
    for (let step = 0; step < 8; step += 1) {
      await user.click(within(dialog).getByRole("button", { name: "Zoom in" }));
    }
    expect(within(dialog).getByRole("button", { name: "Zoom in" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(width()).toHaveStyle({ width: "1200px" });
  });
});

describe("Markdown with a diagram", () => {
  it("hands the mermaid blocks to the MermaidBlock", async () => {
    mermaid.render.mockResolvedValue({ svg: SVG });
    renderWithStore(<Markdown>{"Before\n\n```mermaid\nflowchart LR\n```\n\nAfter"}</Markdown>);

    await waitFor(() => expect(mermaid.render).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Full screen" })).toBeInTheDocument();
  });

  it("draws the caret of a speech that still grows after its last block, and only then", () => {
    const { container, rerender } = renderWithStore(<Markdown streaming>Half a sen</Markdown>);

    expect(container.querySelector(".streaming-caret")).toHaveAttribute("aria-hidden", "true");
    rerender(<Markdown>Half a sen</Markdown>);
    expect(container.querySelector(".streaming-caret")).toBeNull();
  });
});
