import { screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Button } from "./Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter, type DialogProps } from "./Dialog";
import { Field } from "./Field";
import { Input } from "./Input";

function Subject(props: Partial<DialogProps>) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open onOpenChange={() => {}} title="New task" initialFocus={cancel} {...props}>
      <DialogBody>Describe the task.</DialogBody>
      <DialogFooter reason={{ id: "create-reason", text: "Name the task first" }}>
        <Button ref={cancel}>Cancel</Button>
        <Button variant="primary" disabled reasonId="create-reason">
          Create
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("is a modal dialog named by its title", () => {
    renderWithStore(<Subject />);
    const dialog = screen.getByRole("dialog", { name: "New task" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("is an alert dialog with alert", () => {
    renderWithStore(<Subject alert title="Delete task?" />);
    expect(screen.getByRole("alertdialog", { name: "Delete task?" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
  });

  it("closes with the close button", async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithStore(<Subject onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithStore(<Subject onOpenChange={onOpenChange} />);
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("confirms on Ctrl+Enter", async () => {
    const onConfirm = vi.fn();
    const { user } = renderWithStore(<Subject onConfirm={onConfirm} />);
    // The keys reach the dialog only once the initial focus has landed inside it.
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("puts the focus on the initial element", async () => {
    renderWithStore(<Subject />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("opens an alert on its Cancel, which closes it", async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithStore(
      <Dialog open onOpenChange={onOpenChange} title="Delete task?" alert>
        <DialogBody>The worktree is removed.</DialogBody>
        <DialogFooter>
          <DialogCancel />
          <Button variant="danger">Delete</Button>
        </DialogFooter>
      </Dialog>,
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.click(cancel);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("opens any other dialog on the first field of its body", async () => {
    renderWithStore(
      <Dialog open onOpenChange={() => {}} title="New task">
        <DialogBody>
          <Field label="Title">
            <Input />
          </Field>
          <Field label="Branch">
            <Input />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogCancel />
        </DialogFooter>
      </Dialog>,
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Title" })).toHaveFocus());
  });

  it("opens on the dialog itself when the body has no field, never on the close button", async () => {
    renderWithStore(
      <Dialog open onOpenChange={() => {}} title="What changed">
        <DialogBody>Three steps were added.</DialogBody>
      </Dialog>,
    );
    await waitFor(() => expect(screen.getByRole("dialog", { name: "What changed" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveFocus();
  });

  it("shows the subtitle", () => {
    renderWithStore(<Subject subtitle="Step 2 of 3" />);
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
  });

  it("describes the disabled confirmation with the reason of the footer", () => {
    renderWithStore(<Subject />);
    expect(screen.getByRole("button", { name: "Create" })).toHaveAccessibleDescription(
      "Name the task first",
    );
  });

  it("announces a refusal and keeps Back on the left", () => {
    renderWithStore(
      <Dialog open onOpenChange={() => {}} title="New task">
        <DialogFooter
          refusal="The branch already exists"
          back={<Button variant="ghost">Back</Button>}
        >
          <Button>Cancel</Button>
        </DialogFooter>
      </Dialog>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The branch already exists");
    expect(screen.getByRole("button", { name: "Back" }).parentElement).toHaveClass("mr-auto");
  });
});
