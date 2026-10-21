import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { ImageStrip } from "./ImageStrip";
import { ImageThumb } from "./ImageThumb";

describe("ImageThumb", () => {
  it("opens the image from its button, named by the label", async () => {
    const onOpen = vi.fn();
    const { user } = renderWithStore(
      <ImageThumb
        src="/i/a.png"
        label="Image 1 of 2"
        size="sm"
        caption="Card #474"
        onOpen={onOpen}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Image 1 of 2" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Card #474")).toBeInTheDocument();
    expect(screen.getByRole("button").querySelector("img")).toHaveAttribute("loading", "lazy");
  });

  it("draws the × only when it can be removed", async () => {
    const onRemove = vi.fn();
    const { user } = renderWithStore(
      <ImageThumb
        src="/i/a.png"
        label="Image 1 of 1"
        size="md"
        onOpen={() => {}}
        onRemove={onRemove}
        removeLabel="Remove image 1"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove image 1" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("shows the image icon when the image doesn't load", () => {
    renderWithStore(<ImageThumb src="/i/gone.png" label="Image" size="sm" onOpen={() => {}} />);

    const button = screen.getByRole("button", { name: "Image" });
    fireEvent.error(button.querySelector("img") as HTMLImageElement);

    expect(button.querySelector("img")).toBeNull();
    expect(button.querySelector("svg")).not.toBeNull();
  });
});

describe("ImageStrip", () => {
  it("lists each thumbnail under the label", () => {
    renderWithStore(
      <ImageStrip label="Images">
        <span>one</span>
        <span>two</span>
      </ImageStrip>,
    );

    expect(screen.getByRole("list", { name: "Images" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
