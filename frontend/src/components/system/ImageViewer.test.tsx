import { screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { ImageThumb } from "./ImageThumb";
import { ImageViewer } from "./ImageViewer";

function Subject() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ImageThumb src="/i/a.png" label="Image 1 of 1" size="md" onOpen={() => setOpen(true)} />
      <ImageViewer
        open={open}
        onOpenChange={setOpen}
        title="print.png"
        src="/i/a.png"
        alt="A print"
      />
    </>
  );
}

describe("ImageViewer", () => {
  it("shows the image whole under its title", async () => {
    const { user } = renderWithStore(<Subject />);

    await user.click(screen.getByRole("button", { name: "Image 1 of 1" }));

    const dialog = screen.getByRole("dialog", { name: "print.png" });
    expect(dialog).toHaveAttribute("data-dialog-size", "full");
    expect(screen.getByRole("img", { name: "A print" })).toHaveClass("object-contain");
  });

  it("closes with Esc and gives the focus back to the thumbnail", async () => {
    const { user } = renderWithStore(<Subject />);
    const thumb = screen.getByRole("button", { name: "Image 1 of 1" });
    await user.click(thumb);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(thumb).toHaveFocus();
  });

  it("closes with the ×", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.click(screen.getByRole("button", { name: "Image 1 of 1" }));

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
