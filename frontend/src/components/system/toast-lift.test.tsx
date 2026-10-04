import { render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useToastLift } from "./toast-lift";

function Docked() {
  const ref = useRef<HTMLDivElement>(null);
  useToastLift(ref);
  return <div ref={ref}>composer</div>;
}

describe("useToastLift", () => {
  it("lifts the toasts of the main area to the top of the element, and lets them down when it goes", () => {
    const main = document.createElement("main");
    main.className = "main-area";
    document.body.append(main);
    // The main area is 800 high, and the composer stands from 671.4 to its foot.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      const top = this === main ? 0 : 671.4;
      return DOMRect.fromRect({ x: 0, y: top, width: 100, height: 800 - top });
    });

    const { unmount } = render(<Docked />, { container: main });

    expect(main.style.getPropertyValue("--toast-lift")).toBe("129px");
    unmount();
    expect(main.style.getPropertyValue("--toast-lift")).toBe("");
    main.remove();
  });

  it("lifts nothing outside a main area", () => {
    const { container } = render(<Docked />);

    expect(container.closest(".main-area")).toBeNull();
    expect(document.body.style.getPropertyValue("--toast-lift")).toBe("");
  });
});
