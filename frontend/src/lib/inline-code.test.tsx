import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { inlineCode, spokenTitle } from "./inline-code";

describe("inlineCode", () => {
  it("draws the stretches between backticks as code", () => {
    const { container } = render(<p>{inlineCode("The lockfile pins two versions of `vite`")}</p>);
    expect(container.querySelector("code")).toHaveTextContent("vite");
    expect(container).toHaveTextContent("The lockfile pins two versions of vite");
  });

  it("draws every pair", () => {
    const { container } = render(<p>{inlineCode("`a` and `b`")}</p>);
    expect([...container.querySelectorAll("code")].map((code) => code.textContent)).toEqual([
      "a",
      "b",
    ]);
  });

  it("leaves a backtick with no partner as it is", () => {
    const { container } = render(<p>{inlineCode("A stray ` tick")}</p>);
    expect(container.querySelector("code")).toBeNull();
    expect(container).toHaveTextContent("A stray ` tick");
  });
});

describe("spokenTitle", () => {
  it("drops the backticks", () => {
    expect(spokenTitle("Pins `vite` twice")).toBe("Pins vite twice");
  });
});
