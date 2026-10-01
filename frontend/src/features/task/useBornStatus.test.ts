import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBornStatus } from "@/features/task/useBornStatus";

function born(situationId: string | null, status: string) {
  return renderHook(({ id, text }) => useBornStatus(id, text), {
    initialProps: { id: situationId, text: status },
  });
}

describe("useBornStatus", () => {
  it("announces nothing for the situation already there when the screen mounted", () => {
    const { result, rerender } = born("s-1", "Step 1 is ready to approve");

    expect(result.current).toBe("");
    rerender({ id: "s-1", text: "Step 1 is ready to approve, 2 files" });
    expect(result.current).toBe("");
  });

  it("announces nothing without a situation", () => {
    const { result, rerender } = born("s-1", "Step 1 is ready to approve");

    rerender({ id: null, text: "" });

    expect(result.current).toBe("");
  });

  it("announces a situation born after, with the status it was born with", () => {
    const { result, rerender } = born(null, "");

    rerender({ id: "s-2", text: "The agent asks a question" });
    expect(result.current).toBe("The agent asks a question");

    rerender({ id: "s-2", text: "The agent asks 2 questions" });
    expect(result.current).toBe("The agent asks a question");
  });

  it("announces each new situation once it is born", () => {
    const { result, rerender } = born("s-1", "Step 1 is ready to approve");

    rerender({ id: "s-2", text: "The agent asks a question" });
    rerender({ id: "s-3", text: "The session stopped with an error" });

    expect(result.current).toBe("The session stopped with an error");
  });
});
