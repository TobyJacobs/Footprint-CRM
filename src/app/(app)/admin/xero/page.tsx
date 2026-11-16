import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import { Badge, Card, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { getXero, isXeroConfigured } from "@/lib/xero/client";
import { defaultSalesTaxType } from "@/lib/xero/sync";
import { disconnectXero, retryXeroJob, saveXeroSettings, syncXeroNow } from "./actions";

type Settings = {
  connected: boolean;
  tenant_name: string | null;
  connected_at: string | null;
  connected_by: string | null;
  auto_send: boolean;
  send_from: string | null;
  use_os_numbers: boolean;
  tax_map: Record<string, string>;
  last_sync_at: string | null;
  last_error: string | null;
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "—";

// Connect FootprintOS to Xero, the safety switches, VAT codes and what's been sent.
export default async function XeroAdmin(props: PageProps<"/admin/xero">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const supabase = await createClient();
  const site = await siteUrl();
  const configured = isXeroConfigured();
  const [{ data: s }, { data: taxRates }, { data: jobs }] = await Promise.all([
    supabase.rpc("xero_admin_settings"),
    supabase.from("tax_rates").select("id, name, rate").order("rate", { ascending: false }),
    supabase.from("xero_sync_jobs").select("id, kind, record_id, status, attempts, last_error, updated_at").order("updated_at", { ascending: false }).limit(40),
  ]);
  const settings = s as Settings | null;
  const jobIds = (jobs ?? []).map((j) => j.record_id);
  const { data: docs } = jobIds.length ? await supabase.from("sales_documents").select("id, number").in("id", jobIds) : { data: [] };
  const numberOf = (id: string) => (docs ?? []).find((d) => d.id === id)?.number ?? "—";

  // Xero's own list of tax rates, to pick from (only when connected).
  let xeroTaxes: { TaxType: string; Name: string }[] = [];
  if (settings?.connected && configured) {
    try {
      const xero = await getXero();
      const res = await xero?.call("TaxRates");
      xeroTaxes = ((res?.data.TaxRates as { TaxType: string; Name: string; Status: string; CanApplyToRevenue?: boolean }[] | undefined) ?? []).filter(
        (t) => t.Status === "ACTIVE" && t.CanApplyToRevenue !== false,
      );
    } catch {
      xeroTaxes = [];
    }
  }
  const pending = (jobs ?? []).filter((j) => j.status === "pending").length;
  const failed = (jobs ?? []).filter((j) => j.status === "failed").length;

  return (
    <div className="grid max-w-4xl gap-6">
      <Notice searchParams={sp} />
      {sp.connected === "1" && (
        <p role="status" className="rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
          Connected to Xero. Nothing is sent automatically until you turn it on below.
        </p>
      )}
      {typeof sp.synced === "string" && (
        <p role="status" className="rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
          Sync finished: {sp.synced} sent to Xero.
        </p>
      )}

      <Card title="Connection">
        {!configured ? (
          <div className="grid gap-3 text-sm">
            <p>To connect, Footprint needs a (free) app in Xero&apos;s developer portal. One-off steps:</p>
            <ol className="ml-5 grid list-decimal gap-2">
              <li>
                Go to{" "}
                <a href="https://developer.xero.com/app/manage" target="_blank" rel="noopener noreferrer" className="font-semibold text-fp-teal-deep underline">
                  developer.xero.com/app/manage
                </a>{" "}
                and sign in with your Xero login. Choose <strong>New app</strong> → <strong>Web app</strong>, name it &ldquo;FootprintOS&rdquo;, company URL
                https://footprintgroup.uk.
              </li>
              <li>
                Redirect URI: <code className="break-all">{site}/api/xero/callback</code> <CopyButton text={`${site}/api/xero/callback`} label="Copy" />
              </li>
              <li>
                In <strong>Configuration</strong>, copy the <strong>Client ID</strong>, and generate and copy a <strong>Client secret</strong>.
              </li>
              <li>
                In Netlify (Site configuration → Environment variables) add <code>XERO_CLIENT_ID</code> and <code>XERO_CLIENT_SECRET</code> with those values,
                then redeploy. Never paste them into a chat or email.
              </li>
              <li>Come back here and press Connect to Xero.</li>
            </ol>
          </div>
        ) : settings?.connected ? (
          <div className="grid gap-3 text-sm">
            <p>
              <Badge tone="teal">Connected</Badge> to <strong>{settings.tenant_name}</strong> by {settings.connected_by ?? "an admin"} on {when(settings.connected_at)}.
            </p>
            <p className="text-fp-mid">
              Last sync {when(settings.last_sync_at)} · {pending} waiting · {failed} failed
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={syncXeroNow}>
                <button type="submit" className={primaryButton}>
                  Sync now
                </button>
              </form>
              <Link href="/api/xero/connect" prefetch={false} className={secondaryButton}>
                Reconnect
              </Link>
              <form action={disconnectXero}>
                <button type="submit" className="px-2 py-2 text-sm font-semibold text-fp-error hover:underline">
                  Disconnect
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 text-sm">
            <p>The Xero app is set up in Netlify. Connect it to Footprint&apos;s Xero organisation (you&apos;ll sign in to Xero and choose the organisation).</p>
            <div>
              <Link href="/api/xero/connect" prefetch={false} className={primaryButton}>
                Connect to Xero
              </Link>
            </div>
          </div>
        )}
      </Card>

      {settings?.connected && (
        <form action={saveXeroSettings} className="grid gap-6">
          <Card title="What to send">
            <div className="grid gap-4 text-sm">
              <label className="flex items-start gap-2">
                <input type="checkbox" name="auto_send" defaultChecked={settings.auto_send} className="mt-0.5 accent-fp-pink" />
                <span>
                  <strong>Send automatically</strong>: when an invoice or credit note is issued, it goes to Xero as a <strong>draft</strong> within about 5
                  minutes. Off: nothing goes unless someone presses &ldquo;Send to Xero&rdquo; on it.
                </span>
              </label>
              <label className="grid max-w-xs gap-1">
                <span className="font-semibold">Only send automatically if issued on or after</span>
                <input type="date" name="send_from" defaultValue={settings.send_from ?? ""} className={inputClass} />
                <span className="text-xs text-fp-mid">Keeps older (test) invoices out of Xero.</span>
              </label>
              <fieldset className="grid gap-1">
                <legend className="font-semibold">Invoice numbers in Xero</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" name="numbers" value="os" defaultChecked={settings.use_os_numbers} className="accent-fp-pink" /> FootprintOS numbers (the
                  same number in both)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="numbers" value="xero" defaultChecked={!settings.use_os_numbers} className="accent-fp-pink" /> Xero&apos;s own numbers
                  (FootprintOS shows both)
                </label>
              </fieldset>
            </div>
          </Card>

          <Card title="VAT codes">
            <p className="mb-3 text-sm text-fp-mid">Which Xero tax rate each FootprintOS VAT rate becomes on sales.</p>
            <div className="grid gap-2 text-sm">
              {(taxRates ?? []).map((t) => {
                const current = settings.tax_map[t.id] ?? defaultSalesTaxType(Number(t.rate));
                return (
                  <label key={t.id} className="grid items-center gap-2 sm:grid-cols-[14rem_1fr]">
                    <span className="font-semibold">{t.name}</span>
                    {xeroTaxes.length ? (
                      <select name={`tax_${t.id}`} defaultValue={current} className={inputClass}>
                        {!xeroTaxes.some((x) => x.TaxType === current) && <option value={current}>{current}</option>}
                        {xeroTaxes.map((x) => (
                          <option key={x.TaxType} value={x.TaxType}>
                            {x.Name} ({x.TaxType})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input name={`tax_${t.id}`} defaultValue={current} className={inputClass} />
                    )}
                  </label>
                );
              })}
            </div>
          </Card>
          <div>
            <button type="submit" className={primaryButton}>
              Save Xero settings
            </button>
          </div>
        </form>
      )}

      {(jobs ?? []).length > 0 && (
        <Card title="Recently sent">
          <ul className="divide-y divide-fp-border text-sm">
            {(jobs ?? []).map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-2 py-2">
                <Link href={`/sales/${j.record_id}`} className="font-semibold text-fp-teal-deep hover:underline">
                  {numberOf(j.record_id)}
                </Link>
                <span className="text-fp-mid">{j.kind === "credit_note" ? "credit note" : "invoice"}</span>
                {j.status === "done" ? <Badge tone="teal">In Xero</Badge> : j.status === "failed" ? <Badge tone="red">Not sent</Badge> : <Badge tone="amber">Waiting</Badge>}
                <span className="text-xs text-fp-mid">{when(j.updated_at)}</span>
                {j.last_error && j.status !== "done" && <span className="w-full text-xs text-fp-error">{j.last_error}</span>}
                {j.status === "failed" && (
                  <form action={retryXeroJob.bind(null, j.id)}>
                    <button type="submit" className="text-xs font-semibold text-fp-teal-deep hover:underline">
                      Try again
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
