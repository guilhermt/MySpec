import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExternalLink } from "@/components/ExternalLink";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";

describe("ExternalLink", () => {
  it("opens the link in the browser, never in the webview", async () => {
    const { user } = renderWithStore(
      <ExternalLink url="https://github.com/acme/api/pull/1302">#1302</ExternalLink>,
    );

    await user.click(screen.getByRole("link", { name: /#1302/ }));

    expect(api.openExternal).toHaveBeenCalledExactlyOnceWith(
      "https://github.com/acme/api/pull/1302",
    );
  });
});
