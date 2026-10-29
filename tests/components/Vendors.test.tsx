import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { Toaster } from "../../src/components/ui/Toast";
import { VendorList } from "../../src/components/vendors/VendorList";
import { useEventStore } from "../../src/store/useEventStore";
import { event } from "../unit/fixtures";
import { mockAI } from "./aiMock";
import { resetStore } from "./render";

function Vendors() {
  const e = useEventStore((s) => s.events.e1);
  return e ? (
    <>
      <VendorList event={e} />
      <Toaster />
    </>
  ) : null;
}

const vendorCard = (name: string) =>
  screen
    .getAllByRole("listitem")
    .find((li) => within(li).queryByRole("heading", { name })) as HTMLElement;

async function addVendorWithQuote(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  amount: string,
) {
  await user.click(screen.getByRole("button", { name: "Add a vendor" }));
  const dialog = screen.getByRole("dialog", { name: "Add a vendor" });
  await user.type(within(dialog).getByLabelText(/Vendor name/), name);
  await user.selectOptions(within(dialog).getByLabelText(/Budget category/), "Catering");
  await user.type(within(dialog).getByLabelText("Contact"), "private@example.com");
  await user.click(within(dialog).getByRole("button", { name: "Add vendor" }));
  await user.click(
    within(vendorCard(name)).getByRole("button", { name: `Add quote from ${name}` }),
  );
  const quote = screen.getByRole("dialog", { name: `Add a quote from ${name}` });
  await user.type(within(quote).getByLabelText(/Quoted amount/), amount);
  await user.type(within(quote).getByLabelText("What's included"), "Buffet");
  await user.click(within(quote).getByRole("button", { name: "Add quote" }));
}

describe("Vendors tab", () => {
  beforeEach(() => {
    resetStore();
    useEventStore.getState().createEvent(event());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the empty state and the no-prices note with no axe violations", async () => {
    const { container } = render(<Vendors />);
    expect(screen.getByText(/never claims a vendor is available/)).toBeInTheDocument();
    expect(screen.getByText(/No vendors yet/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("compares quotes in a captioned table, flags quotes over the allocation and accepts one", async () => {
    const user = userEvent.setup();
    const { container } = render(<Vendors />);
    await addVendorWithQuote(user, "Annapurna", "450");
    await addVendorWithQuote(user, "Spice Route", "380");

    const table = screen.getByRole("table", {
      name: "Catering quotes compared with ₹400 allocated",
    });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual([
      "Spice Route",
      "Annapurna",
    ]);
    expect(within(rows[1] as HTMLElement).getByText("Over by ₹50")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("Within budget")).toBeInTheDocument();
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
    expect(await axe(container)).toHaveNoViolations();

    await user.click(
      within(table).getByRole("button", { name: "Accept Spice Route quote of ₹380" }),
    );
    const catering = useEventStore
      .getState()
      .events.e1?.budget.find((l) => l.category === "Catering");
    expect(catering).toMatchObject({ committed: 38_000, source: "quote" });
    expect(within(vendorCard("Spice Route")).getByLabelText("Status")).toHaveValue("booked");

    await user.click(within(table).getByRole("button", { name: "Unaccept Spice Route quote" }));
    expect(
      useEventStore.getState().events.e1?.budget.find((l) => l.category === "Catering")?.committed,
    ).toBe(0);
  });

  it("validates the quote form", async () => {
    const user = userEvent.setup();
    render(<Vendors />);
    await user.click(screen.getByRole("button", { name: "Add a vendor" }));
    let dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Add vendor" }));
    expect(within(dialog).getByText("Enter the vendor's name.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Vendor name/), "Bloom");
    await user.click(within(dialog).getByRole("button", { name: "Add vendor" }));
    await user.click(screen.getByRole("button", { name: "Add quote from Bloom" }));
    dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Add quote" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/above 0/);
    await user.type(within(dialog).getByLabelText(/Quoted amount/), "100");
    await user.type(within(dialog).getByLabelText(/Deposit/), "1.234");
    await user.click(within(dialog).getByRole("button", { name: "Add quote" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/deposit/);
  });

  it("drafts vendor questions from event context only, never contact details", async () => {
    const user = userEvent.setup();
    const { calls } = mockAI({
      vendor_questions: () => ({
        questions: ["Do you have step-free access?", "Is the deposit refundable?"],
      }),
    });
    render(<Vendors />);
    await user.click(screen.getByRole("button", { name: "Add a vendor" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Vendor name/), "Annapurna");
    await user.type(within(dialog).getByLabelText("Contact"), "secret-phone-123");
    await user.click(within(dialog).getByRole("button", { name: "Add vendor" }));

    await user.click(screen.getByRole("button", { name: "Draft questions to ask Annapurna" }));
    expect(await screen.findByText("Do you have step-free access?")).toBeInTheDocument();
    expect(JSON.stringify(calls[0]?.input)).not.toContain("secret-phone-123");
    expect(calls[0]?.input).toMatchObject({ category: "Catering", profile: { guestCount: 60 } });
    expect(useEventStore.getState().events.e1?.vendors[0]?.questions).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Copy questions" }));
    expect(await navigator.clipboard.readText()).toBe(
      "1. Do you have step-free access?\n2. Is the deposit refundable?",
    );
  });

  it("shows an alert with Try again when drafting fails", async () => {
    const user = userEvent.setup();
    mockAI({ vendor_questions: "fail" });
    render(<Vendors />);
    useEventStore
      .getState()
      .addVendor("e1", { name: "Bloom", category: "Decor", status: "considering" });
    await user.click(await screen.findByRole("button", { name: "Draft questions to ask Bloom" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("edits and removes a vendor", async () => {
    const user = userEvent.setup();
    useEventStore
      .getState()
      .addVendor("e1", { name: "Bloom", category: "Decor", status: "considering" });
    render(<Vendors />);
    await user.selectOptions(within(vendorCard("Bloom")).getByLabelText("Status"), "contacted");
    expect(useEventStore.getState().events.e1?.vendors[0]?.status).toBe("contacted");
    await user.click(screen.getByRole("button", { name: "Edit Bloom" }));
    const dialog = screen.getByRole("dialog", { name: "Edit Bloom" });
    await user.type(within(dialog).getByLabelText("Notes"), "Call Friday");
    await user.click(within(dialog).getByRole("button", { name: "Save vendor" }));
    expect(screen.getByText("Call Friday")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Bloom" }));
    expect(screen.getByText(/No vendors yet/)).toBeInTheDocument();
  });
});
