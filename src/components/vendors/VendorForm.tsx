import { useState, type FormEvent } from "react";
import { TEXT } from "../../lib/constants";
import { vendorInput, type VendorFields } from "../../lib/forms";
import { VendorStatus, type Event, type Vendor } from "../../schemas/event";
import { useEventStore } from "../../store/useEventStore";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field, inputClass } from "../ui/Field";

export const STATUS_LABELS: Record<VendorStatus, string> = {
  considering: "Considering",
  contacted: "Contacted",
  quoted: "Quoted",
  booked: "Booked",
  declined: "Declined",
};

type Props = { event: Event; vendor?: Vendor; open: boolean; onClose: () => void };

function initialFields(vendor: Vendor | undefined, categories: string[]): VendorFields {
  if (!vendor) {
    return {
      name: "",
      category: categories[0] ?? "",
      contact: "",
      status: "considering",
      notes: "",
    };
  }
  const { name, category, status } = vendor;
  return { name, category, status, contact: vendor.contact ?? "", notes: vendor.notes ?? "" };
}

export function VendorForm({ event, vendor, open, onClose }: Props) {
  const addVendor = useEventStore((s) => s.addVendor);
  const updateVendor = useEventStore((s) => s.updateVendor);
  const categories = event.budget.map((l) => l.category);
  const init = initialFields(vendor, categories);
  const [name, setName] = useState(init.name);
  const [category, setCategory] = useState(init.category);
  const [contact, setContact] = useState(init.contact);
  const [status, setStatus] = useState<VendorStatus>(init.status);
  const [notes, setNotes] = useState(init.notes);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input = vendorInput({ name, category, status, contact, notes });
    if (!input.ok) {
      setError(input.error);
      return;
    }
    if (vendor) updateVendor(event.id, vendor.id, input.value);
    else addVendor(event.id, input.value);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={vendor ? `Edit ${vendor.name}` : "Add a vendor"}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Vendor name" required error={error ?? undefined}>
          {(p) => (
            <input
              {...p}
              className={inputClass}
              maxLength={TEXT.NAME}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field label="Budget category" required>
          {(p) => (
            <select
              {...p}
              className={inputClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Status">
          {(p) => (
            <select
              {...p}
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(VendorStatus.parse(e.target.value))}
            >
              {VendorStatus.options.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label="Contact"
          hint="Phone, email or website. Stays in this browser and is never sent to the AI."
        >
          {(p) => (
            <input
              {...p}
              className={inputClass}
              maxLength={TEXT.SHORT_NOTE}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          )}
        </Field>
        <Field label="Notes">
          {(p) => (
            <textarea
              {...p}
              className={inputClass}
              rows={3}
              maxLength={TEXT.LONG_NOTE}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{vendor ? "Save vendor" : "Add vendor"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
