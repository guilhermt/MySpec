import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DependencyList } from "@/features/discussion/DependencyList";
import type { Draft, DraftDependency } from "@/lib/wails";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDraft, makeDraftRef, makeState } from "@/test/wails-mock";

function makeDependency(overrides: Partial<DraftDependency> = {}): DraftDependency {
  return {
    draft: "draft-2",
    key: "",
    reference: "",
    title: "Group the invoices",
    url: "",
    linked: false,
    dropped: "",
    detail: "",
    ...overrides,
  };
}

function list(draftOverrides: Partial<Draft> = {}, readOnly = false) {
  const draft = makeDraft(draftOverrides);
  return renderWithStore(
    <DependencyList discussionId="discussion-1" draft={draft} readOnly={readOnly} />,
    { state: makeState() },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DependencyList", () => {
  it("names each dependency and what became of it", () => {
    list({
      dependencies: [
        makeDependency(),
        makeDependency({
          draft: "",
          key: "dev/web#9",
          reference: "dev/web#9",
          title: "Export",
          url: "https://github.com/dev/web/issues/9",
          linked: true,
        }),
        makeDependency({ draft: "draft-3", title: "Discarded one", dropped: "discarded" }),
        makeDependency({
          draft: "draft-4",
          title: "Unavailable one",
          dropped: "unavailable",
          detail: "no permission",
        }),
      ],
    });

    expect(screen.getByRole("link", { name: "dev/web#9 · Export" })).toBeInTheDocument();
    expect(screen.getByText("Linked")).toBeInTheDocument();
    expect(screen.getByText("Dropped: discarded")).toBeInTheDocument();
    expect(screen.getByText("Couldn't record: no permission")).toBeInTheDocument();
  });

  it("removes a dependency that is not on GitHub yet", async () => {
    const { user } = list({ dependencies: [makeDependency()] });

    await user.click(screen.getByRole("button", { name: "Remove dependency draft-2" }));

    expect(api.removeDraftDependency).toHaveBeenCalledWith("discussion-1", "draft-1", "draft-2");
  });

  it("keeps a dependency GitHub already has", () => {
    list({ dependencies: [makeDependency({ linked: true })] });

    expect(
      screen.queryByRole("button", { name: "Remove dependency draft-2" }),
    ).not.toBeInTheDocument();
  });

  it("adds a dependency by its reference", async () => {
    const { user } = list();

    await user.type(screen.getByLabelText("Add a dependency"), "dev/web#9");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(api.addDraftDependency).toHaveBeenCalledWith("discussion-1", "draft-1", "dev/web#9");
  });

  it("shows why a dependency was refused", async () => {
    vi.mocked(api.addDraftDependency).mockRejectedValueOnce(new Error("Draft x-1 doesn't exist."));
    const { user } = list();

    await user.type(screen.getByLabelText("Add a dependency"), "x-1");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Draft x-1 doesn't exist.");
  });

  it("dims the dependencies the card has on GitHub and the draft does not", () => {
    list({
      kind: "update",
      dependencies: [],
      current: {
        title: "Export the invoices",
        body: "",
        module: "",
        status: "",
        epic: null,
        dependencies: [makeDraftRef({ draft: "", key: "dev/web#9", reference: "dev/web#9" })],
        readAt: new Date().toISOString(),
      },
    });

    expect(screen.getByText("On GitHub")).toBeInTheDocument();
  });

  it("reads two spellings of the same issue as one dependency", () => {
    list({
      kind: "update",
      dependencies: [
        makeDependency({
          draft: "",
          key: "dev/web#9",
          reference: "Dev/Web#9",
          title: "Export",
        }),
      ],
      current: {
        title: "Export the invoices",
        body: "",
        module: "",
        status: "",
        epic: null,
        dependencies: [
          makeDraftRef({ draft: "", key: "dev/web#9", reference: "dev/web#9", title: "Export" }),
        ],
        readAt: new Date().toISOString(),
      },
    });

    expect(screen.queryByText("On GitHub")).not.toBeInTheDocument();
  });

  it("removes an issue by the reference the draft writes", async () => {
    const { user } = list({
      dependencies: [
        makeDependency({ draft: "", key: "dev/web#9", reference: "Dev/Web#9", title: "Export" }),
      ],
    });

    await user.click(screen.getByRole("button", { name: "Remove dependency Dev/Web#9" }));

    expect(api.removeDraftDependency).toHaveBeenCalledWith("discussion-1", "draft-1", "Dev/Web#9");
  });

  it("changes nothing once the publication started", () => {
    list({ dependencies: [makeDependency()] }, true);

    expect(screen.queryByLabelText("Add a dependency")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove dependency draft-2" }),
    ).not.toBeInTheDocument();
  });
});
