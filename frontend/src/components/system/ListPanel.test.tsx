import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { LIST_PANEL_COLUMN_MIN, ListPanel } from "./ListPanel";

function panel(scrollKey = "acme/api#474") {
  const onClose = vi.fn();
  const onOpenExternal = vi.fn();
  const element = (key: string) => (
    <ListPanel
      label="Card #474"
      number="#474"
      repository="acme/api"
      url="https://github.com/acme/api/issues/474"
      onOpenExternal={onOpenExternal}
      onClose={onClose}
      scrollKey={key}
    >
      <p>The body</p>
    </ListPanel>
  );
  const rendered = renderWithStore(element(scrollKey));
  return { ...rendered, onClose, onOpenExternal, element };
}

describe("ListPanel", () => {
  it("is a complementary region named by the card, with its reference in the head", () => {
    panel();
    const region = screen.getByRole("complementary", { name: "Card #474" });
    expect(region).toHaveTextContent("#474 · acme/api");
    expect(region).toHaveTextContent("The body");
  });

  it("opens the card on GitHub", async () => {
    const { user, onOpenExternal } = panel();
    await user.click(screen.getByRole("button", { name: "Open #474 on GitHub" }));
    expect(onOpenExternal).toHaveBeenCalledWith("https://github.com/acme/api/issues/474");
  });

  it("closes", async () => {
    const { user, onClose } = panel();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("starts the body at the top when the card changes", () => {
    const { rerender, element } = panel();
    const viewport = screen.getByText("The body").closest("[data-slot], div") as HTMLElement;
    const scrollTo = vi.fn();
    for (let node: HTMLElement | null = viewport; node !== null; node = node.parentElement) {
      node.scrollTo = scrollTo;
    }
    rerender(element("acme/api#412"));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it("stands beside the list from 800px of main area", () => {
    expect(LIST_PANEL_COLUMN_MIN).toBe(800);
  });
});
