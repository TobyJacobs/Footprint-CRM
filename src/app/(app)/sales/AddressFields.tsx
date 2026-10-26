"use client";

import { useEffect, useRef, useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { warehouses } from "@/lib/sales/options";

type Options = { billing: string | null; shipping: string | null; contacts: { name: string; address: string }[] };

// The event the document editor sends when a different customer is picked.
export const CUSTOMER_PICKED = "document-customer-picked";

const COLLECT = "Collect from Footprint";
const collectText = (warehouse: string) => (warehouse ? `${COLLECT}, ${warehouse} warehouse` : COLLECT);

// Billing address, "deliver to" and delivery notes on a sales order (owner,
// 26 October 2026). They fill in from the customer and can be changed; "Deliver
// to" picks one of the customer's addresses, collection or a different one.
export default function AddressFields({
  customerId,
  initial,
}: {
  customerId: string | null;
  initial: { billing: string | null; delivery: string | null; notes: string | null; warehouse: string | null };
}) {
  const [warehouse, setWarehouse] = useState(initial.warehouse ?? "");
  const [options, setOptions] = useState<Options | null>(null);
  const [billing, setBilling] = useState(initial.billing ?? "");
  const [delivery, setDelivery] = useState(initial.delivery ?? "");
  const [picked, setPicked] = useState("");
  const deliveryBox = useRef<HTMLTextAreaElement>(null);
  // Only fill in from the customer when the boxes started empty, or a new customer is picked.
  const fillOnLoad = useRef(!initial.billing && !initial.delivery);

  useEffect(() => {
    const load = async (id: string | null, fill: boolean) => {
      if (!id) return setOptions(null);
      const res = await fetch(`/api/search/addresses?customer=${id}`);
      const o: Options | null = res.ok ? await res.json() : null;
      setOptions(o);
      if (o && fill) {
        setBilling(o.billing ?? "");
        setDelivery(o.shipping ?? o.billing ?? "");
        setPicked(o.shipping ? "shipping" : o.billing ? "billing" : "");
      }
    };
    load(customerId, fillOnLoad.current);
    const onPicked = (e: Event) => load((e as CustomEvent<string | null>).detail, true);
    window.addEventListener(CUSTOMER_PICKED, onPicked);
    return () => window.removeEventListener(CUSTOMER_PICKED, onPicked);
  }, [customerId]);

  const choose = (value: string) => {
    setPicked(value);
    if (value === "shipping") setDelivery(options?.shipping ?? "");
    else if (value === "billing") setDelivery(billing);
    else if (value === "collect") setDelivery(collectText(warehouse));
    else if (value.startsWith("contact:")) setDelivery(options?.contacts[Number(value.slice(8))]?.address ?? "");
    else if (value === "other") {
      setDelivery("");
      deliveryBox.current?.focus();
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Field label="Billing address" hint="Goes on the order and the invoice.">
        <textarea name="billing_address" rows={4} value={billing} onChange={(e) => setBilling(e.target.value)} className={inputClass} />
      </Field>
      <div className="grid content-start gap-2">
        <Field label="Deliver to">
          <select value={picked} onChange={(e) => choose(e.target.value)} className={inputClass}>
            <option value="" disabled>
              Choose where to deliver…
            </option>
            {options?.shipping && <option value="shipping">Customer&apos;s shipping address</option>}
            <option value="billing">Same as the billing address</option>
            {options?.contacts.map((p, i) => (
              <option key={`${p.name}-${i}`} value={`contact:${i}`}>
                {p.name}&apos;s address
              </option>
            ))}
            <option value="collect">{COLLECT}</option>
            <option value="other">A different address…</option>
          </select>
        </Field>
        <textarea
          ref={deliveryBox}
          name="delivery_address"
          rows={4}
          aria-label="Delivery address"
          value={delivery}
          onChange={(e) => setDelivery(e.target.value)}
          className={inputClass}
        />
      </div>
      <Field label="Warehouse" hint="Where it goes out from, or is collected from.">
        <select
          name="warehouse"
          value={warehouse}
          onChange={(e) => {
            setWarehouse(e.target.value);
            // Keep a collection address in step with the warehouse.
            if (delivery.startsWith(COLLECT)) setDelivery(collectText(e.target.value));
          }}
          className={inputClass}
        >
          <option value="">Not chosen yet</option>
          {warehouses.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Delivery notes" hint="e.g. leave at reception, deliver after 2pm.">
        <textarea name="delivery_notes" rows={4} defaultValue={initial.notes ?? ""} className={inputClass} />
      </Field>
    </div>
  );
}
