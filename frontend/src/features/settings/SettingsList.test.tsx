import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsGroup, SettingsList, SettingsRow } from "./SettingsList";
import { SettingsBlock, SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("has the title as the h2, the sentence under it and the action at its side", () => {
    render(
      <SettingsPage
        title="Boards"
        sentence="The GitHub projects tasks come from."
        action={<button type="button">Add board</button>}
      >
        <p>content</p>
      </SettingsPage>,
    );

    const title = screen.getByRole("heading", { level: 2, name: "Boards" });
    expect(title).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("The GitHub projects tasks come from.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add board" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("gives the title to the ref it is handed", () => {
    const ref = { current: null as HTMLHeadingElement | null };
    render(
      <SettingsPage title="Boards" sentence="." titleRef={ref}>
        {null}
      </SettingsPage>,
    );

    expect(ref.current).toBe(screen.getByRole("heading", { name: "Boards" }));
  });
});

describe("SettingsBlock", () => {
  it("has the title as an h3 and its sentence beside it", () => {
    render(
      <SettingsBlock title="Review mode" sentence="Who reviews">
        <p>content</p>
      </SettingsBlock>,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Review mode" })).toBeInTheDocument();
    expect(screen.getByText("Who reviews")).toBeInTheDocument();
  });

  it("goes without a sentence", () => {
    render(
      <SettingsBlock title="Models">
        <p>content</p>
      </SettingsBlock>,
    );

    expect(screen.getByRole("heading", { name: "Models" }).parentElement?.children).toHaveLength(1);
  });
});

describe("SettingsList", () => {
  it("is a named list of rows", () => {
    render(
      <SettingsList label="Boards">
        <SettingsRow icon="board" name="Roadmap" lines={<span>Roadmap</span>} />
        <SettingsRow icon="board" name="Mobile" lines={<span>Mobile</span>} />
      </SettingsList>,
    );

    const list = screen.getByRole("list", { name: "Boards" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((row) => row.getAttribute("aria-label")),
    ).toEqual(["Roadmap", "Mobile"]);
  });
});

describe("SettingsRow", () => {
  it("holds the lines, what is at the right and what is below", () => {
    render(
      <ul>
        <SettingsRow
          icon="repository"
          name="acme/api"
          lines={<span>acme/api</span>}
          trailing={<button type="button">Clone</button>}
          below={<p role="alert">The clone is missing</p>}
        />
      </ul>,
    );

    const row = screen.getByRole("listitem", { name: "acme/api" });
    expect(within(row).getByRole("button", { name: "Clone" })).toBeInTheDocument();
    expect(within(row).getByRole("alert")).toHaveTextContent("The clone is missing");
  });
});

describe("SettingsGroup", () => {
  it("has the title, the count and the note over its rows", () => {
    render(
      <SettingsGroup title="Needs a clone" count={3} note="These can't start a task.">
        <p>rows</p>
      </SettingsGroup>,
    );

    const group = screen.getByRole("region", { name: "Needs a clone" });
    expect(group).toHaveTextContent("Needs a clone");
    expect(screen.getByRole("heading", { level: 4, name: "Needs a clone" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("These can't start a task.")).toBeInTheDocument();
  });
});
