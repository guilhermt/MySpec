import { screen, within } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { type PlaceCrumb, PlaceHeader, type PlaceNav } from "./PlaceHeader";

function header(
  options: {
    back?: PlaceNav | null;
    forward?: PlaceNav | null;
    crumbs?: readonly PlaceCrumb[];
    title?: string;
  } = {},
) {
  return renderWithStore(
    <PlaceHeader
      back={options.back ?? null}
      forward={options.forward ?? null}
      crumbs={options.crumbs ?? []}
      title={options.title ?? "Rotate API keys without downtime"}
      titleRef={createRef()}
      backRef={createRef()}
      forwardRef={createRef()}
    >
      <button type="button">Pause</button>
    </PlaceHeader>,
  );
}

describe("PlaceHeader", () => {
  it("names the place in a heading the focus can reach", () => {
    header();

    const title = screen.getByRole("heading", {
      level: 1,
      name: "Rotate API keys without downtime",
    });
    expect(title).toHaveAttribute("tabindex", "-1");
  });

  it("shows the whole title in the tooltip, for when it is cut", async () => {
    const { user } = header();

    await user.hover(screen.getByRole("heading", { level: 1 }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Rotate API keys without downtime",
    );
  });

  it("goes back to the place named in the tooltip, with its key", async () => {
    const onClick = vi.fn();
    const { user } = header({ back: { title: "Platform Roadmap", onClick } });

    await user.tab();
    const back = screen.getByRole("button", { name: "Back to Platform Roadmap" });
    expect(back).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Back to Platform Roadmap");
    expect(tooltip).toHaveTextContent("Alt+←");

    await user.click(back);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables Back with the reason when nothing is behind", () => {
    header();

    const back = screen.getByRole("button", { name: "Back" });
    expect(back).toHaveAttribute("aria-disabled", "true");
    expect(back).toHaveAccessibleDescription("Nothing to go back to");
  });

  it("goes forward to the place named in the tooltip, with its key", async () => {
    const onClick = vi.fn();
    const { user } = header({ forward: { title: "Reviews", onClick } });

    const forward = screen.getByRole("button", { name: "Forward to Reviews" });
    await user.hover(forward);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Forward to Reviews");
    expect(tooltip).toHaveTextContent("Alt+→");

    await user.click(forward);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("has no Forward with nothing ahead", () => {
    header();

    expect(screen.queryByRole("button", { name: /^Forward/ })).not.toBeInTheDocument();
  });

  it("lists the levels above the place, the ones with a place as links", async () => {
    const onOpen = vi.fn();
    const { user } = header({
      crumbs: [{ label: "Platform Roadmap", onOpen }, { label: "API hardening" }],
    });

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const items = within(nav).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Platform Roadmap/", "API hardening/"]);
    expect(within(nav).queryByRole("button", { name: "API hardening" })).not.toBeInTheDocument();

    await user.click(within(nav).getByRole("button", { name: "Platform Roadmap" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("folds the levels into … with a menu of them", async () => {
    const onOpen = vi.fn();
    const { user } = header({
      crumbs: [{ label: "Platform Roadmap", onOpen }, { label: "API hardening" }],
    });

    await user.click(
      screen.getByRole("button", {
        name: "Show the hidden levels: Platform Roadmap / API hardening",
      }),
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "API hardening" })).toBeNull();
    expect(within(menu).getByText("API hardening")).toBeInTheDocument();

    await user.click(within(menu).getByRole("menuitem", { name: "Platform Roadmap" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("has no breadcrumb for a place with no level above", () => {
    header();

    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Show the hidden levels/ })).toBeNull();
  });

  it("holds on the right what the place gives it", () => {
    header();

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("draws the progress of the item after the title, before what the place holds", () => {
    renderWithStore(
      <PlaceHeader
        back={null}
        forward={null}
        crumbs={[]}
        title="Rate limit per API key"
        titleRef={createRef()}
        backRef={createRef()}
        forwardRef={createRef()}
        progress={<ol aria-label="Progress" />}
      >
        <button type="button">Pause</button>
      </PlaceHeader>,
    );

    const title = screen.getByRole("heading", { level: 1 });
    const progress = screen.getByRole("list", { name: "Progress" });
    const pause = screen.getByRole("button", { name: "Pause" });
    expect(title.compareDocumentPosition(progress)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(progress.compareDocumentPosition(pause)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
