import type { Metadata } from "next";
import Link from "next/link";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import CopyButton from "@/components/CopyButton";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, Notice, dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { botConfigured } from "@/lib/chat-bot";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { deleteChatWidget, saveChatWidget, savePortalAssistant } from "../actions";

export const metadata: Metadata = { title: "Website chat" };

type Widget = {
  id: string;
  public_id: string;
  name: string;
  site_name: string;
  greeting: string;
  knowledge: string;
  pipeline_id: string;
  owner_id: string | null;
  notify_ids: string[];
  privacy_url: string | null;
  bot_enabled: boolean;
  active: boolean;
};
// Website chat set-up (Wave 8, Marketing edit): each website's chat box. A
// Grok bot answers; chats it hands over need a person (the chosen people are
// emailed when the visitor leaves details). The chats are read in Customer
// support → Website chat.
export default async function WebsiteChatSetupPage(props: PageProps<"/leads/chat">) {
  const user = await getCurrentUser();
  if (!user.can("marketing", "edit")) return <NoAccess title="Website chat" />;
  const canEdit = true;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: widgetRows }, { data: pipelines }, { data: people }, { data: assistantRow }] = await Promise.all([
    supabase.from("chat_widgets").select("*").order("created_at"),
    supabase.from("lead_pipelines").select("id, name").eq("active", true).order("position"),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase.rpc("portal_bot_settings"),
  ]);
  const assistant = assistantRow as { enabled: boolean; greeting: string; knowledge: string } | null;
  const widgets = (widgetRows ?? []) as Widget[];
  const site = await siteUrl();
  const bot = botConfigured();
  const adding = canEdit && (sp.add === "1" || widgets.length === 0);
  const personName = (id: string | null) => {
    const p = (people ?? []).find((x) => x.id === id);
    return p ? (p.full_name ?? p.email) : null;
  };
  const snippet = (w: Widget) => `<script src="${site}/chat-widget.js" data-chat="${w.public_id}" async></script>`;

  const fields = (w?: Widget) => (
    <div className="grid gap-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="font-semibold">Chat box name (staff only)</span>
          <input name="name" required maxLength={100} defaultValue={w?.name ?? ""} placeholder="e.g. Forget Me Not website" className={inputClass} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Business name (shown at the top)</span>
          <input name="site_name" required maxLength={100} defaultValue={w?.site_name ?? ""} placeholder="e.g. Forget Me Not" className={inputClass} />
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Leads go into</span>
          <select name="pipeline_id" required defaultValue={w?.pipeline_id ?? pipelines?.[0]?.id} className={inputClass}>
            {(pipelines ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} pipeline
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-semibold">Lead owner (always emailed)</span>
          <select name="owner_id" defaultValue={w?.owner_id ?? user.id} className={inputClass}>
            <option value="">Nobody yet</option>
            {(people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details className="rounded-md border border-fp-border p-3">
        <summary className="cursor-pointer font-semibold">Who else to email when a chat needs a person</summary>
        <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
          {(people ?? []).map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input type="checkbox" name="notify_ids" value={p.id} defaultChecked={w?.notify_ids.includes(p.id) ?? false} className="accent-fp-pink" />
              {p.full_name ?? p.email}
            </label>
          ))}
        </div>
      </details>
      <label className="grid gap-1">
        <span className="font-semibold">Greeting</span>
        <input name="greeting" required maxLength={500} defaultValue={w?.greeting ?? "Hi! How can we help today?"} className={inputClass} />
      </label>
      <label className="grid gap-1">
        <span className="font-semibold">What the bot knows</span>
        <span className="text-xs text-fp-mid">
          Plain facts the bot may use: what you do, areas, opening hours, how to book, where prices are. It answers only from this and hands anything else to a person.
          Don&apos;t put anything private here.
        </span>
        <textarea name="knowledge" rows={10} maxLength={12000} defaultValue={w?.knowledge ?? ""} className={inputClass} />
      </label>
      <label className="grid gap-1">
        <span className="font-semibold">Privacy policy link (optional, recommended)</span>
        <input name="privacy_url" type="url" maxLength={300} defaultValue={w?.privacy_url ?? ""} placeholder="https://…" className={inputClass} />
      </label>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="bot_enabled" defaultChecked={w?.bot_enabled ?? true} className="accent-fp-pink" />
          Grok bot answers (untick to send every chat straight to a person)
        </label>
        {w && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked={w.active} className="accent-fp-pink" />
            Chat switched on
          </label>
        )}
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title="Website chat" intro="The chat boxes on Footprint's websites, in place of the GoHighLevel chat. A Grok bot answers; anything too complex comes to a person." />
      <div className="grid max-w-5xl gap-5 px-4 py-6 sm:px-6 lg:px-10">
        <Link href="/leads" className="text-sm font-semibold text-fp-teal-deep hover:underline">
          ← Lead pipelines
        </Link>
        <Notice searchParams={sp} />
        {!bot && (
          <p className="rounded-md border border-fp-amber bg-fp-amber/10 px-4 py-3 text-sm">
            <strong>The Grok bot is off:</strong> there&apos;s no xAI key in Netlify yet, so every chat goes straight to &ldquo;leave your details&rdquo;. Add XAI_API_KEY (and
            XAI_MODEL, the model to use) in Netlify to switch it on.
          </p>
        )}

        <p className="text-sm">
          The chats themselves are in{" "}
          <Link href="/support/chat" className="font-semibold text-fp-teal-deep hover:underline">
            Customer support → Website chat
          </Link>
          .
        </p>
        {canEdit &&
          widgets.map((w) => {
            const open = sp.box === w.id;
            return (
              <Card
                key={w.id}
                title={w.name}
                action={
                  <span className="flex items-center gap-2 text-sm">
                    {w.active ? <Badge tone="teal">On</Badge> : <Badge>Switched off</Badge>}
                    {w.bot_enabled && bot ? <Badge tone="teal">Grok bot</Badge> : <Badge tone="amber">Straight to a person</Badge>}
                    <Link href={open ? "/leads/chat" : `/leads/chat?box=${w.id}`} scroll={false} className={secondaryButton}>
                      {open ? "Close" : "Change"}
                    </Link>
                  </span>
                }
              >
                <p className="text-sm text-fp-dark/80">
                  Into the <strong>{(pipelines ?? []).find((p) => p.id === w.pipeline_id)?.name ?? "—"}</strong> pipeline · emails{" "}
                  {[w.owner_id, ...w.notify_ids].filter((v, i, a) => v && a.indexOf(v) === i).map(personName).filter(Boolean).join(", ") || "nobody (choose someone)"}
                </p>
                <div className="mt-4 grid gap-2 text-sm">
                  <p className="font-semibold">Put it on the website</p>
                  <p className="text-fp-mid">Paste this just before &lt;/body&gt; on every page (in place of the GoHighLevel chat code). A chat bubble appears in the bottom corner.</p>
                  <textarea readOnly rows={2} value={snippet(w)} aria-label="Code for the website" className={`${inputClass} font-mono text-xs`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton text={snippet(w)} label="Copy website code" />
                    <a href={`${site}/c/${w.public_id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-fp-teal-deep hover:underline">
                      Try the chat ↗
                    </a>
                  </div>
                </div>
                {open && (
                  <div className="mt-5 grid gap-4 border-t border-fp-border pt-5">
                    <form action={saveChatWidget.bind(null, w.id)} className="grid gap-4">
                      {fields(w)}
                      <div>
                        <button type="submit" className={primaryButton}>
                          Save chat box
                        </button>
                      </div>
                    </form>
                    <form action={deleteChatWidget.bind(null, w.id)}>
                      <ConfirmSubmit message={`Delete "${w.name}"? Its chats are deleted too (leads it made stay), and the website's chat bubble stops working.`} className={dangerButton}>
                        Delete chat box
                      </ConfirmSubmit>
                    </form>
                  </div>
                )}
              </Card>
            );
          })}
        {canEdit &&
          (adding ? (
            <Card title="New chat box">
              <form action={saveChatWidget.bind(null, null)} className="grid gap-4">
                {fields()}
                <div className="flex gap-2">
                  <button type="submit" className={primaryButton}>
                    Create chat box
                  </button>
                  {widgets.length > 0 && (
                    <Link href="/leads/chat" className={secondaryButton}>
                      Cancel
                    </Link>
                  )}
                </div>
              </form>
            </Card>
          ) : (
            <div>
              <Link href="/leads/chat?add=1" scroll={false} className={primaryButton}>
                New chat box
              </Link>
            </div>
          ))}
        {assistant && (
          <Card
            title="Customer portal assistant"
            action={assistant.enabled && bot ? <Badge tone="teal">Grok bot</Badge> : assistant.enabled ? <Badge tone="amber">Waiting for the xAI key</Badge> : <Badge>Switched off</Badge>}
          >
            <p className="text-sm text-fp-dark/80">
              The &ldquo;Ask a question&rdquo; bubble in the customer portal. It answers from what you write below <strong>and</strong> from that customer&apos;s own
              records (quotes, orders, design work, adverts, invoices, hosting, support). It can&apos;t change anything. &ldquo;Send to the team&rdquo; turns the chat into a
              conversation in Customer support.
            </p>
            <form action={savePortalAssistant} className="mt-4 grid gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="enabled" defaultChecked={assistant.enabled} />
                <span className="font-semibold">Show the assistant in the portal</span>
              </label>
              <label className="grid gap-1">
                <span className="font-semibold">Greeting</span>
                <input name="greeting" required maxLength={500} defaultValue={assistant.greeting} className={inputClass} />
              </label>
              <label className="grid gap-1">
                <span className="font-semibold">What the assistant knows about Footprint</span>
                <span className="text-fp-mid">Opening hours, how proofs and payments work, delivery times, who to talk to. It only says what&apos;s here or in the customer&apos;s records.</span>
                <textarea name="knowledge" rows={8} maxLength={12000} defaultValue={assistant.knowledge} className={inputClass} />
              </label>
              <div>
                <button type="submit" className={primaryButton}>
                  Save
                </button>
              </div>
            </form>
            <p className="mt-3 text-xs text-fp-mid">
              Limits: 20 messages an hour and 60 a day per customer, 3,000 a day in all. Chats are deleted after 90 days (anything sent to the team stays in Customer support).
            </p>
          </Card>
        )}
        <p className="text-xs text-fp-mid">
          Limits keep costs and spam down: 30 messages an hour from one connection, 40 per chat and 2,000 a day per chat box. Chats are deleted after 12 months. The bot only
          writes replies: it can&apos;t book, change or look anything up.
        </p>
      </div>
    </>
  );
}
