import { screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useCardImages } from "@/features/images/useCardImages";
import { CardContextLine } from "@/features/task-create/CardContextLine";
import { useCardRefresh } from "@/features/task-create/useCardRefresh";
import type { Attachment } from "@/lib/images";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoardCard, makeCardImage, makeCardImageFailure, makeState } from "@/test/wails-mock";

const FRESH = () => new Date(Date.now() - 60_000).toISOString();
const STALE = () => new Date(Date.now() - 10 * 60_000).toISOString();

const ATTACHED: Attachment = {
  id: "mine",
  name: "mine.png",
  mediaType: "image/png",
  blob: new Blob(),
  url: "blob:mine",
};

function Line({
  readAt,
  images = [],
  onRemoveImage,
  imageRefusal = null,
}: {
  readAt: string;
  images?: Attachment[];
  onRemoveImage?: (id: string) => void;
  imageRefusal?: string | null;
}) {
  const [additional, setAdditional] = useState("");
  const card = makeBoardCard({ readAt });
  const refresh = useCardRefresh("board-1", card);
  const cardImages = useCardImages("board-1", [card.key], !refresh.refreshing, refresh.version);
  return (
    <CardContextLine
      boardId="board-1"
      card={card}
      additional={additional}
      onAdditionalChange={setAdditional}
      refresh={refresh}
      cardImages={cardImages}
      images={images}
      onAttach={vi.fn()}
      {...(onRemoveImage !== undefined ? { onRemoveImage } : {})}
      imageRefusal={imageRefusal}
    />
  );
}

function line(readAt: string, props: Omit<Parameters<typeof Line>[0], "readAt"> = {}) {
  return renderWithStore(<Line readAt={readAt} {...props} />, { state: makeState() });
}

describe("CardContextLine", () => {
  it("says what the context has, with its size, once it is read", async () => {
    vi.mocked(api.cardContext).mockResolvedValue("x".repeat(1200));

    line(FRESH());

    expect(await screen.findByText("From the card: #12 · 1,200 characters")).toBeVisible();
    expect(api.cardContext).toHaveBeenCalledWith("board-1", "dev/web#12");
    expect(api.refreshCard).not.toHaveBeenCalled();
  });

  it("shows and hides the context of the card", async () => {
    const { user } = line(FRESH());
    await screen.findByText(/characters/);

    const show = screen.getByRole("button", { name: "Show" });
    expect(show).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();

    await user.click(show);

    expect(await screen.findByTestId("markdown")).toHaveTextContent(
      "### Card: Add the login screen",
    );
    expect(screen.getByLabelText("The context from the card")).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Hide" }));

    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
  });

  it("opens the additional context on Add to it, and keeps it", async () => {
    const { user } = line(FRESH());

    expect(screen.queryByLabelText(/Additional context/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add to it" }));

    const field = screen.getByLabelText(/Additional context/);
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute(
      "placeholder",
      "Anything the card doesn't say. It goes at the end of the context.",
    );
    expect(screen.queryByRole("button", { name: "Add to it" })).not.toBeInTheDocument();

    await user.type(field, "Start with the form");

    expect(field).toHaveValue("Start with the form");
  });

  it("reads a stale card again and its context after", async () => {
    let finish = () => {};
    vi.mocked(api.refreshCard).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );

    line(STALE());

    expect((await screen.findAllByRole("status"))[0]).toHaveTextContent("Refreshing the card…");
    expect(api.refreshCard).toHaveBeenCalledOnce();
    expect(api.refreshCard).toHaveBeenCalledWith("board-1", "dev/web#12");
    expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("The card is being read again.")).toBeVisible();

    vi.mocked(api.cardContext).mockResolvedValue("### Card: Refreshed\n");
    finish();

    await waitFor(() => {
      expect(screen.queryByText("Refreshing the card…")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(api.cardContext).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute("aria-disabled", "false");
  });

  it("says the task will use the last reading when the refresh fails", async () => {
    vi.mocked(api.refreshCard).mockRejectedValue(new Error("GitHub rate limit reached."));

    line(STALE());

    expect(
      await screen.findByText(
        /Couldn't refresh the card: GitHub rate limit reached\. The task will use the last reading\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/From the card: #12/)).toBeInTheDocument();
  });

  it("counts nothing and keeps Show out of reach when the context could not be read", async () => {
    vi.mocked(api.cardContext).mockResolvedValue("");

    line(FRESH());

    await waitFor(() => expect(api.cardContext).toHaveBeenCalled());
    expect(screen.getByText("From the card: #12")).toBeVisible();
    expect(screen.queryByText(/characters/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show" })).toHaveAttribute("aria-disabled", "true");
    expect(await screen.findByText("Couldn't read the context.")).toBeVisible();
  });

  describe("images", () => {
    it("counts the images of the card and of the user, and says when it is reading", async () => {
      let finish: (value: { images: ReturnType<typeof makeCardImage>[]; failures: [] }) => void =
        () => {};
      vi.mocked(api.cardImages).mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );

      line(FRESH(), { images: [ATTACHED] });

      expect(await screen.findByText(/· reading images…/)).toBeVisible();
      finish({
        images: [makeCardImage(), makeCardImage({ id: "b".repeat(64), position: 2 })],
        failures: [],
      });

      expect(await screen.findByText(/From the card: #12.* · 3 images/)).toBeVisible();
      expect(api.cardImages).toHaveBeenCalledWith("board-1", ["dev/web#12"]);
    });

    it("says which images could not be read, with a link to each", async () => {
      vi.mocked(api.cardImages).mockResolvedValue({
        images: [],
        failures: [makeCardImageFailure()],
      });

      line(FRESH());

      expect(
        await screen.findByText(
          /The image "Logo" of the card #12 couldn't be read: it's over 20 MB\./,
        ),
      ).toBeVisible();
      expect(screen.getByRole("link", { name: "Open" })).toBeVisible();
    });

    it("shows the Images section on Show, with the read and the attached images", async () => {
      vi.mocked(api.cardImages).mockResolvedValue({ images: [makeCardImage()], failures: [] });
      const { user } = line(FRESH(), { images: [ATTACHED] });
      await screen.findByText(/2 images/);

      await user.click(screen.getByRole("button", { name: "Show" }));

      expect(screen.getByText("Images")).toBeVisible();
      expect(screen.getByRole("button", { name: "Image 1 of 2, Logo" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Image 2 of 2, mine.png" })).toBeVisible();
      expect(screen.getByText("Card #12")).toBeVisible();
      expect(screen.getByText("Your text")).toBeVisible();
    });

    it("waits for the card to be read again before reading its images", async () => {
      let finish = () => {};
      vi.mocked(api.refreshCard).mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );

      line(STALE());
      await screen.findAllByText("Refreshing the card…");
      expect(api.cardImages).not.toHaveBeenCalled();

      finish();

      await waitFor(() => expect(api.cardImages).toHaveBeenCalledTimes(1));
    });

    it("draws the images attached to the additional context, with × only when it can remove", async () => {
      const onRemoveImage = vi.fn();
      const { user } = line(FRESH(), {
        images: [ATTACHED],
        onRemoveImage,
        imageRefusal: "Not attached · a.bmp isn't PNG, JPEG, GIF or WebP",
      });
      await user.click(screen.getByRole("button", { name: "Add to it" }));

      expect(screen.getByText(/Not attached · a\.bmp/)).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Remove image 1, mine.png" }));

      expect(onRemoveImage).toHaveBeenCalledWith("mine");
    });
  });
});
