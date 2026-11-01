import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { axe } from "vitest-axe";
import { Badge } from "../../src/components/ui/Badge";
import { Button } from "../../src/components/ui/Button";
import { Dialog } from "../../src/components/ui/Dialog";
import { ErrorBoundary } from "../../src/components/ui/ErrorBoundary";
import { Field, inputClass } from "../../src/components/ui/Field";
import { LiveRegion } from "../../src/components/ui/LiveRegion";
import { PageHeading } from "../../src/components/ui/PageHeading";
import { TabPanel, Tabs } from "../../src/components/ui/Tabs";
import { toast, Toaster, TOAST_MS, useToasts } from "../../src/components/ui/Toast";

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open settings</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Settings" description="Change it">
        <label htmlFor="name">Name</label>
        <input id="name" />
        <Button onClick={() => setOpen(false)}>Save</Button>
      </Dialog>
    </>
  );
}

function TabsDemo() {
  const tabs = [
    { key: "a", label: "Alpha" },
    { key: "b", label: "Beta" },
    { key: "c", label: "Gamma" },
  ] as const;
  const [sel, setSel] = useState<"a" | "b" | "c">("a");
  return (
    <>
      <Tabs label="Demo" idPrefix="demo" tabs={tabs} selected={sel} onSelect={setSel} />
      <TabPanel idPrefix="demo" tabKey={sel}>
        Panel {sel}
      </TabPanel>
    </>
  );
}

describe("UI kit", () => {
  it("Button, Badge, Field and LiveRegion have no axe violations", async () => {
    const { container } = render(
      <div>
        <Button>Save</Button>
        <Badge tone="danger" icon={AlertTriangle}>
          Over budget
        </Badge>
        <Field label="Guests" hint="1 to 1000" error="Too many" required>
          {(p) => <input {...p} type="number" className={inputClass} />}
        </Field>
        <LiveRegion busy>Drafting…</LiveRegion>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
    const input = screen.getByLabelText(/Guests/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription("1 to 1000 Too many");
    expect(screen.getByText("(required)")).toBeInTheDocument();
  });

  it("Dialog traps focus, closes on Esc and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<DialogDemo />);
    const trigger = screen.getByRole("button", { name: "Open settings" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(await axe(document.body)).toHaveNoViolations();

    await user.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("Tabs follow the WAI-ARIA pattern with arrow, Home and End keys", async () => {
    const user = userEvent.setup();
    const { container } = render(<TabsDemo />);
    expect(await axe(container)).toHaveNoViolations();
    const alpha = screen.getByRole("tab", { name: "Alpha" });
    expect(alpha).toHaveAttribute("aria-selected", "true");
    alpha.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel b");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveFocus();
    await user.keyboard("x");
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveFocus();
  });

  it("Toasts are polite, offer an action and disappear after the timeout", async () => {
    const onUndo = vi.fn();
    const { container } = render(<Toaster />);
    act(() => toast("Change applied.", { label: "Undo", onClick: onUndo }));
    expect(screen.getByRole("status")).toHaveTextContent("Change applied.");
    expect(await axe(container)).toHaveNoViolations();
    vi.useFakeTimers();
    act(() => screen.getByRole("button", { name: "Undo" }).click());
    expect(onUndo).toHaveBeenCalled();
    act(() => toast("Saved."));
    act(() => {
      vi.advanceTimersByTime(TOAST_MS - 1);
    });
    expect(screen.getByText("Saved.")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("Saved.")).not.toBeInTheDocument();
    act(() => toast("Bye."));
    act(() => screen.getByRole("button", { name: "Dismiss notification" }).click());
    expect(useToasts.getState().toasts).toEqual([]);
    vi.useRealTimers();
  });

  it("PageHeading sets the document title", () => {
    render(<PageHeading title="Budget" />);
    expect(document.title).toBe("Budget · Hostwise");
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("tabindex", "-1");
  });

  it("ErrorBoundary shows an alert with Try again instead of crashing", () => {
    const Boom = () => {
      throw new Error("boom");
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    spy.mockRestore();
  });
});
