import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftImageStrip } from "@/features/discussion/DraftImageStrip";
import { renderWithStore } from "@/test/render";

const ID = "0b6c3c1e-2f8a-4c7e-9b1d-2a4f5e6d7c8b";
const TEXT = `![shot](images/${ID}.png) and ![](https://github.com/user-attachments/assets/x)`;

describe("DraftImageStrip", () => {
  it("draws nothing without images", () => {
    const { container } = renderWithStore(
      <DraftImageStrip discussionId="d-1" issue={null} text="plain" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("draws a thumbnail of each image through the route of the discussion", () => {
    renderWithStore(<DraftImageStrip discussionId="d-1" issue={null} text={TEXT} />);

    const first = screen.getByRole("button", { name: "Image 1 of 2, shot" });
    expect(first.querySelector("img")).toHaveAttribute("src", `/myspec/images/d-1/${ID}.png`);
    expect(
      screen.getByRole("button", { name: "Image 2 of 2, no alternative text" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Take image/ })).not.toBeInTheDocument();
  });

  it("takes an image out by its destination", async () => {
    const onRemove = vi.fn();
    const { user } = renderWithStore(
      <DraftImageStrip discussionId="d-1" issue={null} text={TEXT} onRemove={onRemove} />,
    );

    await user.click(screen.getByRole("button", { name: "Take image 1 out of the body, shot" }));

    expect(onRemove).toHaveBeenCalledExactlyOnceWith(`images/${ID}.png`);
  });

  it("opens an image large", async () => {
    const { user } = renderWithStore(
      <DraftImageStrip discussionId="d-1" issue={null} text={TEXT} />,
    );

    await user.click(screen.getByRole("button", { name: "Image 1 of 2, shot" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
