"use client";

import { useState } from "react";
import { Field, TextArea, TextInput, inputClass } from "@/components/ui";

const parts = ["street", "city", "county", "postcode", "country"] as const;
type Addresses = Record<string, string | null>;

// Billing address, and the delivery (shipping) address only when it's
// different (DJ, 9 November 2026). "Same as billing" saves the billing
// address as the delivery one too (customers/actions).
export default function AddressFields({ values, isNew }: { values: Addresses; isNew: boolean }) {
  const differs = parts.some((p) => (values[`shipping_${p}`] ?? "") !== "" && (values[`shipping_${p}`] ?? "") !== (values[`billing_${p}`] ?? ""));
  const [mode, setMode] = useState<"same" | "different">(differs ? "different" : "same");

  const block = (kind: "billing" | "shipping") => (
    <div className="grid gap-3">
      <p className="text-sm font-bold">{kind === "billing" ? "Billing address" : "Delivery address"}</p>
      <Field label="Street">
        <TextArea name={`${kind}_street`} rows={2} defaultValue={values[`${kind}_street`]} />
      </Field>
      <Field label="Town / city">
        <TextInput name={`${kind}_city`} defaultValue={values[`${kind}_city`]} />
      </Field>
      <Field label="County">
        <TextInput name={`${kind}_county`} defaultValue={values[`${kind}_county`]} />
      </Field>
      <Field label="Postcode">
        <TextInput name={`${kind}_postcode`} defaultValue={values[`${kind}_postcode`]} />
      </Field>
      <Field label="Country">
        <TextInput name={`${kind}_country`} defaultValue={values[`${kind}_country`] ?? (isNew ? "United Kingdom" : null)} />
      </Field>
    </div>
  );

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="grid content-start gap-4">
        {block("billing")}
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Delivery address</span>
          <select name="shipping_mode" value={mode} onChange={(e) => setMode(e.target.value as "same" | "different")} className={inputClass}>
            <option value="same">Same as billing address</option>
            <option value="different">Use a different address than the billing address</option>
          </select>
        </label>
      </div>
      {mode === "different" && block("shipping")}
    </div>
  );
}
