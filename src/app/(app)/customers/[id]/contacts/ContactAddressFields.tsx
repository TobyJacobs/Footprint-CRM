"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

export type Address = { street: string; city: string; county: string; postcode: string; country: string };

const blank: Address = { street: "", city: "", county: "", postcode: "", country: "" };
const keys = Object.keys(blank) as (keyof Address)[];
const isEmpty = (a: Address) => keys.every((k) => !a[k].trim());
const same = (a: Address, b: Address) => keys.every((k) => a[k].trim().toLowerCase() === b[k].trim().toLowerCase());
const oneLine = (a: Address) => keys.map((k) => a[k].trim()).filter(Boolean).join(", ");

// The contact's address, with a dropdown to use the customer's (company)
// billing or delivery address. A contact with no address of its own (new or
// existing) starts on the company's billing address when there is one, so it's
// saved with the contact next time the form is saved. The boxes stay editable.
export default function ContactAddressFields({
  current,
  billing,
  shipping,
}: {
  current: Address;
  billing: Address;
  shipping: Address;
}) {
  const options = [
    ...(!isEmpty(billing) ? [{ value: "billing", label: `Company billing address: ${oneLine(billing)}`, address: billing }] : []),
    ...(!isEmpty(shipping) && (isEmpty(billing) || !same(billing, shipping))
      ? [{ value: "shipping", label: `Company delivery address: ${oneLine(shipping)}`, address: shipping }]
      : []),
  ];

  // Which option matches what's saved (or the company's address when there's none).
  const start = (() => {
    if (isEmpty(current) && options.length) return { choice: options[0].value, address: options[0].address };
    const match = options.find((o) => same(o.address, current));
    if (match && !isEmpty(current)) return { choice: match.value, address: current };
    return { choice: isEmpty(current) ? "none" : "other", address: current };
  })();

  const [choice, setChoice] = useState(start.choice);
  const [address, setAddress] = useState<Address>(start.address);

  function choose(value: string) {
    setChoice(value);
    const picked = options.find((o) => o.value === value);
    if (picked) setAddress({ ...picked.address });
    else if (value === "none") setAddress({ ...blank });
    // "A different address" keeps whatever is in the boxes, ready to change.
  }

  function edit(key: keyof Address, value: string) {
    const next = { ...address, [key]: value };
    setAddress(next);
    // Typing over a company address makes it "a different address".
    const match = options.find((o) => same(o.address, next));
    setChoice(match ? match.value : isEmpty(next) ? "none" : "other");
  }

  const box = (key: keyof Address, label: string, wide = false) => (
    <label className={`grid gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-semibold">{label}</span>
      {key === "street" ? (
        <textarea name={key} rows={2} value={address[key]} onChange={(e) => edit(key, e.target.value)} className={inputClass} />
      ) : (
        <input name={key} value={address[key]} onChange={(e) => edit(key, e.target.value)} className={inputClass} />
      )}
    </label>
  );

  return (
    <>
      <label className="grid gap-1 text-sm sm:col-span-2">
        <span className="font-semibold">Address</span>
        <select value={choice} onChange={(e) => choose(e.target.value)} className={inputClass}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value="other">A different address</option>
          <option value="none">No address</option>
        </select>
        {options.length === 0 && <span className="text-xs text-fp-mid">This customer has no address saved yet.</span>}
      </label>
      {choice !== "none" && (
        <>
          {box("street", "Street", true)}
          {box("city", "Town / city")}
          {box("county", "County")}
          {box("postcode", "Postcode")}
          {box("country", "Country")}
        </>
      )}
      {choice === "none" && keys.map((k) => <input key={k} type="hidden" name={k} value="" />)}
    </>
  );
}
