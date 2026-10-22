import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { YourMessage } from "@/features/chat/entries/YourMessage";
import { clockTime } from "@/lib/when";
import { renderWithStore } from "@/test/render";
import { makeEntry, makeImage } from "@/test/wails-mock";

const IMAGE = makeImage();

describe("YourMessage", () => {
  it("shows what the user wrote, as written, named with its time", () => {
    const entry = makeEntry("user");
    const user = entry.user;
    if (user === null) throw new Error("no user");
    renderWithStore(
      <YourMessage user={{ ...user, text: "one\ntwo **not bold**" }} createdAt={entry.createdAt} />,
    );

    const message = screen.getByRole("article", {
      name: `You, ${clockTime(entry.createdAt, Date.now())}`,
    });
    expect(message).toHaveTextContent("You");
    expect(screen.getByText(/two \*\*not bold\*\*/)).toHaveClass("whitespace-pre-wrap");
  });

  it("shows the images below the text and opens one large", async () => {
    const entry = makeEntry("user");
    const user = entry.user;
    if (user === null) throw new Error("no user");
    const { user: person } = renderWithStore(
      <YourMessage
        user={{ ...user, text: "see this", images: [IMAGE, { ...IMAGE, id: "b" }] }}
        createdAt={entry.createdAt}
      />,
    );

    const first = screen.getByRole("button", { name: "Image 1 of 2" });
    expect(screen.getByRole("list", { name: "Images" })).toBeInTheDocument();
    expect(first.querySelector("img")).toHaveAttribute("src", IMAGE.url);

    await person.click(first);
    expect(screen.getByRole("dialog", { name: "Image 1 of 2" })).toBeInTheDocument();
  });

  it("captions the images of a draft as Your edit", () => {
    const entry = makeEntry("user");
    const user = entry.user;
    if (user === null) throw new Error("no user");
    renderWithStore(
      <YourMessage
        user={{ ...user, text: "see this", images: [{ ...IMAGE, origin: "draft" }] }}
        createdAt={entry.createdAt}
      />,
    );

    expect(screen.getByText("Your edit")).toBeInTheDocument();
  });

  it("draws no text for a message of only images", () => {
    const entry = makeEntry("user");
    const user = entry.user;
    if (user === null) throw new Error("no user");
    renderWithStore(
      <YourMessage user={{ ...user, text: "", images: [IMAGE] }} createdAt={entry.createdAt} />,
    );

    expect(screen.queryByText("", { selector: "p" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Image 1 of 1" })).toBeInTheDocument();
  });
});
