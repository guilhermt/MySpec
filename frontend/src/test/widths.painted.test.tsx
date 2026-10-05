import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/system/Button";
import { LiveRegion } from "@/components/system/LiveRegion";
import { atWindow, proveScene, renderPage, WINDOW_HEIGHT, WINDOWS } from "@/test/widths";

// prove draws something in a main area and runs the checks of the sweep over it.
async function prove(children: ReactNode) {
  render(<main>{children}</main>);
  return proveScene(screen.getByRole("main"));
}

describe("proveScene", () => {
  it("says nothing of a screen that holds every check", async () => {
    expect(
      await prove(
        <>
          <header style={{ height: "48px" }}>
            <h1>Title</h1>
          </header>
          <Button variant="primary">Save</Button>
          <LiveRegion kind="status" />
        </>,
      ),
    ).toEqual({});
  });

  it("bites on a screen wider than the window", async () => {
    const failed = await prove(<div style={{ width: `${window.innerWidth + 400}px` }}>Wide</div>);

    expect(Object.keys(failed)).toContain("horizontal scroll");
  });

  it("bites on a box that stands on half a pixel", async () => {
    const failed = await prove(<header style={{ height: "20.5px" }}>Header</header>);

    expect(failed["whole pixels"]).toContain("Header");
  });

  it("bites on two primaries", async () => {
    const failed = await prove(
      <>
        <Button variant="primary">Save</Button>
        <Button variant="primary">Send</Button>
      </>,
    );

    expect(failed["one primary"]).toHaveLength(2);
  });

  it("bites on pieces of the header that cover one another", async () => {
    const failed = await prove(
      <header style={{ position: "relative", height: "48px" }}>
        <span style={{ position: "absolute", left: 0, width: "100px" }}>One</span>
        <span style={{ position: "absolute", left: "50px", width: "100px" }}>Two</span>
        <div />
      </header>,
    );

    expect(failed["header pieces"]).toHaveLength(1);
  });

  it("bites on a control with no name", async () => {
    const failed = await prove(<button type="button" style={{ width: "24px", height: "24px" }} />);

    expect(failed.names).toEqual(["button"]);
  });

  it("bites on an alert born with the screen and on a status that is no live region", async () => {
    const { main } = renderPage(
      <main>
        <p role="alert">Couldn't read</p>
        <p role="status">Reading…</p>
      </main>,
    );

    expect((await proveScene(main))["live regions"]).toEqual([
      "alert born with the screen: p[alert] Couldn't read",
      "status that is not a live region: p[status] Reading…",
    ]);
  });

  it("lets an alert that arrives after the screen pass", async () => {
    const { main } = renderPage(<main>{null}</main>);
    const alert = document.createElement("p");
    alert.setAttribute("role", "alert");
    alert.textContent = "Couldn't read";
    main.append(alert);

    expect(await proveScene(main)).toEqual({});
  });

  it("bites on a text the screen cuts with nothing to say it whole", async () => {
    const failed = await prove(
      <p
        style={{
          width: "40px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        A name that is much too long for the box
      </p>,
    );

    expect(failed["cut text without a tooltip"]).toHaveLength(1);
  });
});

describe("the windows of the sweep", () => {
  it.each(WINDOWS)("puts the browser at %ipx wide", async (width) => {
    await atWindow(width);

    expect(window.innerWidth).toBe(width);
    expect(window.innerHeight).toBe(WINDOW_HEIGHT);
  });
});
