import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { MoreBelow } from "@/features/sidebar/MoreBelow";
import { setTheme, THEMES, token } from "@/test/painted";

/** LINES are more lines than the viewport shows, as a tree longer than the sidebar has. */
const LINES = Array.from({ length: 12 }, (_, at) => `line-${at + 1}`);

// Subject is a viewport of the tree, on the sidebar's background, with lines below its fold.
function Subject() {
  const viewport = useRef<HTMLDivElement>(null);
  return (
    <div ref={viewport} className="relative h-40 w-60 overflow-y-auto bg-surface-sidebar">
      {LINES.map((line) => (
        <div key={line} data-entry-id={line} className="h-7">
          {line}
        </div>
      ))}
      <MoreBelow viewport={viewport} />
    </div>
  );
}

describe.each(THEMES)("MoreBelow in the %s theme", (theme) => {
  it("lays the text of the label on the solid background of the sidebar, over the lines it fades", async () => {
    setTheme(theme);
    render(<Subject />);
    const label = await screen.findByRole("button", { name: /more below/ });
    const fade = label.parentElement;
    if (fade === null) {
      throw new Error("the fade is not drawn");
    }

    // The fade reaches the sidebar's background at its last stop, and stays solid after it.
    const gradient = getComputedStyle(fade).backgroundImage;
    const last = /^(.+)\s+([\d.]+)%\)$/.exec(gradient.slice(gradient.lastIndexOf("%, ") + 3));
    expect(last?.[1]).toBe(token("--surface-sidebar"));
    const box = fade.getBoundingClientRect();
    const solidFrom = box.top + (box.height * Number(last?.[2])) / 100;
    // The middle of the label, where its text is, stands on the solid part.
    const text = label.getBoundingClientRect();
    expect(text.top + text.height / 2).toBeGreaterThanOrEqual(solidFrom);
  });
});
