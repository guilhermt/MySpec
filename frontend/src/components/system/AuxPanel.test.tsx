import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuxPanel, PanelGroup, PanelLayout, panelTriggerId } from "./AuxPanel";
import { ICONS } from "./icons";
import { setAdjustedPanelWidth } from "./panel-width";

const PANELS = [
  {
    id: "artifacts",
    label: "Artifacts",
    tooltip: "PRD, tech spec, steps and reports",
    icon: ICONS.file,
  },
  { id: "reports", label: "Reports", tooltip: "Reports of every pass", icon: ICONS.file },
] as const;

type Id = (typeof PANELS)[number]["id"];

// Place is a place with two panels, which a state of its own opens and closes.
function Place() {
  const [open, setOpen] = useState<Id | null>(null);
  const panel = PANELS.find((entry) => entry.id === open);
  return (
    <>
      <PanelGroup panels={PANELS} open={open} onOpenChange={setOpen} />
      <PanelLayout
        panel={
          panel !== undefined && (
            <AuxPanel id={panel.id} title={panel.label} onClose={() => setOpen(null)}>
              <p>The body of {panel.label}</p>
            </AuxPanel>
          )
        }
      >
        <p>The reading column</p>
      </PanelLayout>
    </>
  );
}

function place() {
  const user = userEvent.setup();
  render(<Place />);
  return { user };
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1600);
});

afterEach(() => {
  setAdjustedPanelWidth(null);
  vi.restoreAllMocks();
});

describe("AuxPanel", () => {
  it("names the button of a panel by an id of its own", () => {
    place();

    expect(screen.getByRole("button", { name: "Artifacts" })).toHaveAttribute(
      "id",
      panelTriggerId("artifacts"),
    );
    expect(panelTriggerId("reports")).toBe("panel-trigger-reports");
  });

  it("opens closed, with every button unpressed", () => {
    place();

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    for (const name of ["Artifacts", "Reports"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.getByText("The reading column")).toBeInTheDocument();
  });

  it("opens one panel at a time, named after its title", async () => {
    const { user } = place();

    await user.click(screen.getByRole("button", { name: "Artifacts" }));
    expect(screen.getByRole("complementary", { name: "Artifacts" })).toHaveTextContent(
      "The body of Artifacts",
    );
    expect(screen.getByRole("button", { name: "Artifacts" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Reports" }));
    expect(screen.getAllByRole("complementary")).toHaveLength(1);
    expect(screen.getByRole("complementary", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Artifacts" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Reports" })).toHaveAttribute("aria-pressed", "true");
  });

  it("closes the panel its button opened on a second click", async () => {
    const { user } = place();

    await user.click(screen.getByRole("button", { name: "Reports" }));
    await user.click(screen.getByRole("button", { name: "Reports" }));

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("closes on × and gives the focus back to the button of the panel", async () => {
    const { user } = place();

    await user.click(screen.getByRole("button", { name: "Artifacts" }));
    const panel = screen.getByRole("complementary", { name: "Artifacts" });
    await user.click(within(panel).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Artifacts" })).toHaveFocus();
  });

  it("names the panel of each button in its tooltip", async () => {
    const { user } = place();

    await user.hover(screen.getByRole("button", { name: "Reports" }));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Reports");
    expect(tooltip).toHaveTextContent("Reports of every pass");
  });

  describe("resizing", () => {
    async function opened() {
      const { user } = place();
      await user.click(screen.getByRole("button", { name: "Artifacts" }));
      const panel = screen.getByRole("complementary", { name: "Artifacts" });
      return {
        user,
        panel,
        handle: within(panel).getByRole("separator", { name: "Resize the panel" }),
      };
    }

    it("has a handle with the width, the default and the widest", async () => {
      const { handle } = await opened();

      expect(handle).toHaveAttribute("aria-valuenow", "448");
      expect(handle).toHaveAttribute("aria-valuemin", "448");
      expect(handle).toHaveAttribute("aria-valuemax", "1536");
    });

    it("widens by 32 on ← and narrows back on →, never below the default", async () => {
      const { user, panel, handle } = await opened();
      handle.focus();

      await user.keyboard("{ArrowLeft}");
      expect(panel).toHaveStyle({ width: "480px" });
      await user.keyboard("{ArrowRight}");
      expect(panel).toHaveStyle({ width: "448px" });
      await user.keyboard("{ArrowRight}");
      expect(panel).toHaveStyle({ width: "448px" });
    });

    it("leaves a modified arrow, such as Alt+←, to the history", async () => {
      const { user, panel, handle } = await opened();
      handle.focus();

      await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
      expect(panel).toHaveStyle({ width: "448px" });
      expect(handle).toHaveAttribute("aria-valuenow", "448");
    });

    it("follows the pointer in a drag, and marks the window while it lasts", async () => {
      const { panel, handle } = await opened();

      fireEvent.pointerDown(handle, { button: 0, clientX: 1000 });
      expect(document.documentElement).toHaveAttribute("data-panel-resizing");
      fireEvent.pointerMove(window, { clientX: 700 });
      expect(panel).toHaveStyle({ width: "748px" });
      fireEvent.pointerUp(window);

      expect(document.documentElement).not.toHaveAttribute("data-panel-resizing");
      fireEvent.pointerMove(window, { clientX: 500 });
      expect(panel).toHaveStyle({ width: "748px" });
    });

    it("keeps the width when the panel closes and another opens", async () => {
      const { user, handle } = await opened();
      handle.focus();
      await user.keyboard("{ArrowLeft}");

      await user.click(screen.getByRole("button", { name: "Artifacts" }));
      await user.click(screen.getByRole("button", { name: "Reports" }));

      expect(screen.getByRole("complementary", { name: "Reports" })).toHaveStyle({
        width: "480px",
      });
    });

    it("stands beside the column until the width passes the room it keeps", async () => {
      const { panel } = await opened();
      expect(panel).toHaveAttribute("data-beside");

      setAdjustedPanelWidth(900);

      await vi.waitFor(() => expect(panel).not.toHaveAttribute("data-beside"));
    });
  });
});
