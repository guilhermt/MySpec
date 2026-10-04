import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ARCHIVED_FACTS, FACTS, Fact } from "@/components/Facts";

describe("Fact", () => {
  it("is a key and its value in the list of facts", () => {
    render(
      <dl className={FACTS}>
        <Fact label="Branch">feat/rate-limit</Fact>
      </dl>,
    );

    expect(screen.getByRole("term")).toHaveTextContent("Branch");
    expect(screen.getByRole("definition")).toHaveTextContent("feat/rate-limit");
  });
});

describe("ARCHIVED_FACTS", () => {
  it("lays the facts of an archived item as the same keys and values", () => {
    render(
      <dl className={ARCHIVED_FACTS}>
        <Fact label="Base">dev</Fact>
      </dl>,
    );

    expect(screen.getByRole("term")).toHaveTextContent("Base");
    expect(screen.getByRole("definition")).toHaveTextContent("dev");
  });
});
