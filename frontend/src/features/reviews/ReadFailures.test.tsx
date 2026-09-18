import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReadFailures } from "@/features/reviews/ReadFailures";

describe("ReadFailures", () => {
  it("names each repository the reading failed on, with the reason", () => {
    render(
      <ReadFailures
        failures={[
          { repositoryId: "repo-1", repository: "dev/web", message: "gh isn't authenticated." },
          { repositoryId: "repo-2", repository: "dev/api", message: "No access." },
        ]}
      />,
    );

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent("dev/web: gh isn't authenticated.");
    expect(alerts[1]).toHaveTextContent("dev/api: No access.");
  });

  it("shows nothing when every repository was read", () => {
    render(<ReadFailures failures={[]} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
