import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterMenu } from "@/components/FilterMenu";
import { renderWithStore } from "@/test/render";

const OPTIONS = [
  { value: "repo-1", label: "web", title: "dev/web" },
  { value: "repo-2", label: "api", title: "dev/api" },
];

describe("FilterMenu", () => {
  it("names the trigger with the filter and the value it shows", () => {
    renderWithStore(
      <FilterMenu name="Repository" value="repo-2" options={OPTIONS} onChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Repository: api" })).toBeInTheDocument();
  });

  it("reads as Any when the value filters nothing", () => {
    renderWithStore(<FilterMenu name="Repository" value="" options={OPTIONS} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Repository: Any" })).toBeInTheDocument();
  });

  it("picks a value", async () => {
    const onChange = vi.fn();
    const { user } = renderWithStore(
      <FilterMenu name="Repository" value="" options={OPTIONS} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Repository: Any" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "web" }));

    expect(onChange.mock.calls[0]?.[0]).toBe("repo-1");
  });
});
