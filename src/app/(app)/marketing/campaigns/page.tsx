import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Notice, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { gbp, longDate } from "@/lib/customers/display";
import { adPlatforms, campaignStatusLabel, campaignStatuses, campaignTimeUsed, campaignTone, spendPace } from "@/lib/marketing/options";
import { todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { updateSpend } from "../actions";

export default async function CampaignsPage(props: PageProps<"/marketing/campaigns">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const today = todayIso();
  const status = typeof sp.status === "string" && (sp.status === "all" || campaignStatuses.some((s) => s.value === sp.status)) ? sp.status : "running";
  const platform = typeof sp.platform === "string" && (adPlatforms as readonly string[]).includes(sp.platform) ? sp.platform : "";
  const mine = sp.mine === "1";
  const canEdit = user.can("marketing", "edit");
  const supabase = await createClient();

  let query = supabase
    .from("ad_campaigns")
    .select("id, name, platform, status, start_date, end_date, budget, spend, spend_updated_at, leads, owner_id, customers(id, name)")
    .order("end_date", { ascending: true, nullsFirst: false })
    .limit(500);
  if (status === "running") query = query.in("status", ["planned", "live", "paused"]);
  else if (status !== "all") query = query.eq("status", status);
  if (platform) query = query.eq("platform", platform);
  if (mine) query = query.eq("owner_id", user.id);

  const [{ data: campaigns }, { data: people }] = await Promise.all([query, supabase.from("profiles").select("id, full_name, email")]);
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? (p.email as string)]));

  const rows = (campaigns ?? []).map((c) => {
    const spend = Number(c.spend);
    const budget = c.budget === null ? null : Number(c.budget);
    const timeUsed = campaignTimeUsed(c.start_date, c.end_date, today);
    return { c, spend, budget, timeUsed, pace: c.status === "live" ? spendPace(spend, budget, timeUsed) : budget !== null && spend > budget ? "over" : null };
  });
  const live = rows.filter((r) => r.c.status === "live");
  const liveBudget = live.reduce((s, r) => s + (r.budget ?? 0), 0);
  const liveSpend = live.reduce((s, r) => s + r.spend, 0);
  const warnings = rows.filter((r) => r.pace === "over" || r.pace === "ahead").length;
  const here = `/marketing/campaigns?${new URLSearchParams({ ...(status !== "running" ? { status } : {}), ...(platform ? { platform } : {}), ...(mine ? { mine: "1" } : {}) }).toString()}`;

  return (
    <div className="grid gap-6">
      <Notice searchParams={sp} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-fp-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-fp-mid">Live campaigns</p>
          <p className="text-2xl font-black">{live.length}</p>
        </div>
        <div className="rounded-lg border border-fp-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-fp-mid">Live spend so far</p>
          <p className="text-2xl font-black">
            {gbp(liveSpend)} <span className="text-sm font-normal text-fp-mid">of {gbp(liveBudget)}</span>
          </p>
        </div>
        <div className="rounded-lg border border-fp-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-fp-mid">Need a look</p>
          <p className={`text-2xl font-black ${warnings ? "text-fp-error" : ""}`}>{warnings}</p>
          <p className="text-xs text-fp-mid">Spending faster than planned, or over budget</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <label className="grid gap-1">
            <span className="font-semibold">Status</span>
            <select name="status" defaultValue={status} className={inputClass}>
              <option value="running">Planned, live or paused</option>
              {campaignStatuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
              <option value="all">All</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">Platform</span>
            <select name="platform" defaultValue={platform} className={inputClass}>
              <option value="">All platforms</option>
              {adPlatforms.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2">
            <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="accent-fp-pink" />
            Only mine
          </label>
          <button type="submit" className={secondaryButton}>
            Filter
          </button>
        </form>
        {canEdit && (
          <Link href="/marketing/campaigns/new" className={`${primaryButton} inline-flex items-center gap-2`}>
            <Plus size={16} aria-hidden /> New campaign
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-fp-border bg-white p-6 text-sm text-fp-mid">No ad campaigns for these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-fp-border bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-fp-offwhite text-left text-xs uppercase tracking-wide text-fp-mid">
              <tr>
                <th className="px-4 py-2">Campaign</th>
                <th className="px-4 py-2">Platform</th>
                <th className="px-4 py-2">Dates</th>
                <th className="px-4 py-2">Spend vs budget</th>
                <th className="px-4 py-2">Leads</th>
                <th className="px-4 py-2">Owner</th>
                {canEdit && <th className="px-4 py-2">Update spend</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, spend, budget, timeUsed, pace }) => {
                const customer = c.customers as unknown as { id: string; name: string } | null;
                const pct = budget ? Math.min(100, Math.round((spend / budget) * 100)) : 0;
                return (
                  <tr key={c.id} className="border-b border-fp-border align-top last:border-0 hover:bg-fp-offwhite">
                    <td className="px-4 py-3">
                      <Link href={`/marketing/campaigns/${c.id}`} className="font-semibold hover:text-fp-pink">
                        {c.name}
                      </Link>
                      <p className="text-xs text-fp-mid">{customer?.name}</p>
                      <div className="mt-1">
                        <Badge tone={campaignTone(c.status)}>{campaignStatusLabel(c.status)}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">{c.platform}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {c.start_date ? longDate(c.start_date) : "—"}
                      <br />
                      to {c.end_date ? longDate(c.end_date) : "—"}
                    </td>
                    <td className="w-64 px-4 py-3">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold">{gbp(spend)}</span>
                        <span className="text-fp-mid">{budget !== null ? `of ${gbp(budget)}` : "no budget set"}</span>
                      </div>
                      {budget ? (
                        <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-fp-light">
                          <div className={`h-full ${pace === "over" || pace === "ahead" ? "bg-fp-error" : "bg-fp-teal"}`} style={{ width: `${pct}%` }} />
                          {timeUsed !== null && c.status === "live" && (
                            <div className="absolute top-0 h-full w-0.5 bg-fp-dark" style={{ left: `${Math.round(timeUsed * 100)}%` }} title="Where spend should be by now" />
                          )}
                        </div>
                      ) : null}
                      {pace === "over" && <p className="mt-1 text-xs font-semibold text-fp-error">Over budget</p>}
                      {pace === "ahead" && <p className="mt-1 text-xs font-semibold text-fp-error">Spending faster than planned</p>}
                    </td>
                    <td className="px-4 py-3">{c.leads ?? "—"}</td>
                    <td className="px-4 py-3">{c.owner_id ? nameOf.get(c.owner_id) ?? "—" : "—"}</td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <form action={updateSpend.bind(null, c.id)} className="flex items-center gap-2">
                          <input type="hidden" name="back" value={here} />
                          <input
                            name="spend"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={spend}
                            aria-label={`Spend so far on ${c.name}`}
                            className="w-24 rounded-md border border-fp-border bg-white px-2 py-1 text-xs"
                          />
                          <button type="submit" className="text-xs font-semibold text-fp-teal-deep hover:underline">
                            Save
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-fp-mid">The dark line on each bar shows how far through its dates the campaign is. Spend more than 10% ahead of that line is flagged.</p>
    </div>
  );
}
