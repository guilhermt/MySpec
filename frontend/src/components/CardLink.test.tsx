import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardLink } from "@/components/CardLink";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";

const CARD = { number: 12, url: "https://github.com/dev/web/issues/12", status: "In progress" };

describe("CardLink", () => {
  it("opens the card on GitHub, named by its number and its status on the board", async () => {
    const { user } = renderWithStore(<CardLink card={CARD} />);

    await user.click(screen.getByRole("button", { name: "Open card #12 on GitHub · In progress" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/12");
  });

  it("names the card by its number alone without a status", () => {
    renderWithStore(<CardLink card={{ ...CARD, status: "" }} />);

    expect(screen.getByRole("button", { name: "Open card #12 on GitHub" })).toBeInTheDocument();
  });
});
