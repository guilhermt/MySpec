import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardImageFailures } from "@/features/images/CardImageFailures";
import { makeCardImageFailure } from "@/test/wails-mock";

describe("CardImageFailures", () => {
  it("stays an empty status without failures", () => {
    render(<CardImageFailures failures={[]} />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("writes a line for each failure, with a link to the image when it has one", () => {
    render(
      <CardImageFailures
        failures={[
          makeCardImageFailure(),
          makeCardImageFailure({ url: "", alt: "", reason: "gh isn't signed in" }),
        ]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      `The image "Logo" of the card #12 couldn't be read: it's over 20 MB.`,
    );
    expect(
      screen.getByText(/The images of the card #12 couldn't be read: gh isn't signed in\./),
    ).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Open" })).toHaveLength(1);
  });
});
