import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { AuxPanel, PanelGroup, PanelLayout, panelTriggerId } from "./AuxPanel";
import { ICONS } from "./icons";

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
});
