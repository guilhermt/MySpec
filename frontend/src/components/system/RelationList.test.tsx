import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { type RelationGroup, RelationList } from "./RelationList";

const GROUPS: readonly RelationGroup[] = [
  {
    label: "Epic",
    items: [
      {
        key: "epic",
        number: "#400",
        title: "API hardening",
        meta: "",
        url: "https://github.com/acme/api/issues/400",
      },
    ],
  },
  { label: "Cards of the epic · 0", items: [] },
  {
    label: "Dependencies",
    items: [
      {
        key: "dep",
        number: "#398",
        title: "Key store",
        meta: "open",
        url: "https://github.com/acme/api/issues/398",
        warning: "Not satisfied",
      },
    ],
  },
];

describe("RelationList", () => {
  it("draws only the groups with items", () => {
    renderWithStore(<RelationList groups={GROUPS} onOpen={() => {}} />);
    expect(screen.getByRole("region", { name: "Epic" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Dependencies" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Cards of the epic · 0" })).toBeNull();
  });

  it("writes each relation as a link with its meta and warning", () => {
    renderWithStore(<RelationList groups={GROUPS} onOpen={() => {}} />);
    const group = screen.getByRole("region", { name: "Dependencies" });
    expect(within(group).getByRole("link", { name: "#398 Key store" })).toBeInTheDocument();
    expect(within(group).getByRole("listitem")).toHaveTextContent("open◇ Not satisfied");
  });

  it("opens a relation through the caller", async () => {
    const onOpen = vi.fn();
    const { user } = renderWithStore(<RelationList groups={GROUPS} onOpen={onOpen} />);
    await user.click(screen.getByRole("link", { name: "#400 API hardening" }));
    expect(onOpen).toHaveBeenCalledWith("https://github.com/acme/api/issues/400");
  });
});
