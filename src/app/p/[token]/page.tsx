import type { Metadata } from "next";
import { CheckCircle2, ExternalLink, PencilLine } from "lucide-react";
import { inputClass } from "@/components/ui";
import { longDate } from "@/lib/customers/display";
import { createClient } from "@/lib/supabase/server";
import { respondToProof } from "./actions";

export const metadata: Metadata = { title: "Your design proof", robots: { index: false, follow: false } };

type ProofView = {
  status: "waiting" | "approved" | "changes" | "withdrawn";
  expired: boolean;
  expires_at: string;
  sent_at: string;
  message: string | null;
  file_url: string | null;
  file_name: string;
  content_type: string | null;
  version: number;
  job_number: number;
  job_title: string;
  customer_name: string | null;
  response_name: string | null;
  response_note: string | null;
  responded_at: string | null;
  company: { company_name: string | null; phone: string | null; email: string | null } | null;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-fp-offwhite">
      <div className="bg-fp-gradient h-1" />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}

// The page a customer sees when they open the private link to a design proof.
export default async function PublicProofPage(props: PageProps<"/p/[token]">) {
  const { token } = await props.params;
  const sp = await props.searchParams;

  let proof: ProofView | null = null;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_proof_by_token", { p_token: token });
    proof = (data as ProofView | null) ?? null;
  }

  if (!proof) {
    return (
      <Shell>
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-black">Proof not found</h1>
          <p className="mt-2 text-fp-dark/75">This link isn&apos;t valid. Please check it, or contact us and we&apos;ll send a new one.</p>
        </div>
      </Shell>
    );
  }

  const company = proof.company?.company_name ?? "Footprint Group";
  const error = typeof sp.error === "string" ? sp.error : null;
  const canRespond = proof.status === "waiting" && !proof.expired && proof.file_url !== null;
  const isImage = String(proof.content_type ?? "").startsWith("image/");
  const isPdf = proof.content_type === "application/pdf";

  return (
    <Shell>
      <header className="mb-6">
        <p className="text-sm font-semibold text-fp-mid">
          {company} · Design job DJ-{proof.job_number}
        </p>
        <h1 className="text-2xl font-black">{proof.job_title}</h1>
        <p className="mt-1 text-sm text-fp-dark/75">
          Proof version {proof.version}
          {proof.customer_name ? ` for ${proof.customer_name}` : ""}, sent {longDate(proof.sent_at)}
        </p>
      </header>

      {proof.status === "approved" && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-fp-teal-deep/30 bg-fp-teal/10 p-5">
          <CheckCircle2 className="mt-0.5 shrink-0 text-fp-teal-deep" aria-hidden />
          <div>
            <p className="font-bold">Thank you — this proof has been approved.</p>
            <p className="text-sm text-fp-dark/80">
              Approved by {proof.response_name}
              {proof.responded_at ? ` on ${longDate(proof.responded_at)}` : ""}. {company} will take it from here.
            </p>
          </div>
        </div>
      )}
      {proof.status === "changes" && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-fp-border bg-white p-5">
          <PencilLine className="mt-0.5 shrink-0 text-fp-pink" aria-hidden />
          <div>
            <p className="font-bold">Thanks — we&apos;ve got your changes.</p>
            <p className="text-sm text-fp-dark/80">
              Sent by {proof.response_name}
              {proof.responded_at ? ` on ${longDate(proof.responded_at)}` : ""}. We&apos;ll send you a new proof soon.
            </p>
            {proof.response_note && <p className="mt-2 whitespace-pre-line rounded-md bg-fp-offwhite p-3 text-sm">{proof.response_note}</p>}
          </div>
        </div>
      )}
      {proof.status === "withdrawn" && (
        <div className="mb-6 rounded-lg border border-fp-amber bg-fp-amber/10 p-5 text-sm">
          A newer proof has been sent, so this one can no longer be answered. Please use the link in our latest email.
        </div>
      )}
      {proof.status === "waiting" && proof.expired && (
        <div className="mb-6 rounded-lg border border-fp-amber bg-fp-amber/10 p-5 text-sm">
          This link expired on {longDate(proof.expires_at)}. Please contact us and we&apos;ll send a new one.
        </div>
      )}

      {proof.message && proof.status === "waiting" && !proof.expired && (
        <p className="mb-6 whitespace-pre-line rounded-lg bg-white p-5 text-sm shadow-sm">{proof.message}</p>
      )}

      {proof.file_url && (
        <section className="rounded-lg bg-white p-4 shadow-sm">
          {isImage && (
            // The file link is private and time-limited, so a plain img is right here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proof.file_url} alt={`Proof version ${proof.version}`} className="mx-auto max-h-[75vh] w-auto rounded-md border border-fp-border object-contain" />
          )}
          {isPdf && (
            <iframe src={proof.file_url} title={`Proof version ${proof.version}`} className="h-[75vh] w-full rounded-md border border-fp-border" />
          )}
          <p className="mt-3 text-center text-sm">
            <a href={proof.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-fp-teal-deep hover:underline">
              Open {proof.file_name} full size <ExternalLink size={14} aria-hidden />
            </a>
          </p>
        </section>
      )}

      {canRespond && (
        <section className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black">Is this ready to go?</h2>
          <p className="mt-1 text-sm text-fp-dark/75">
            Please check everything carefully: spelling, phone numbers, prices, dates and images. Approving confirms you&apos;re happy for {company} to use this design as it is.
          </p>
          {error && (
            <p role="alert" className="mt-4 rounded-md border border-fp-error/30 bg-fp-error/5 px-3 py-2 text-sm text-fp-error">
              {error}
            </p>
          )}
          <form className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Your full name</span>
              <input name="name" required minLength={2} autoComplete="name" className={inputClass} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Changes you&apos;d like, or any comments</span>
              <span className="text-xs text-fp-mid">Needed if you&apos;re asking for changes. Be as specific as you can.</span>
              <textarea name="note" rows={4} maxLength={5000} className={inputClass} />
            </label>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                formAction={respondToProof.bind(null, token, true)}
                className="rounded-md bg-fp-teal-deep px-5 py-2.5 text-sm font-bold text-white hover:bg-fp-teal-deep/90"
              >
                Approve proof
              </button>
              <button
                formAction={respondToProof.bind(null, token, false)}
                className="rounded-md border border-fp-border bg-white px-5 py-2.5 text-sm font-semibold hover:bg-fp-light"
              >
                Request changes
              </button>
            </div>
          </form>
        </section>
      )}
      {!canRespond && error && (
        <p role="alert" className="mt-6 rounded-md border border-fp-error/30 bg-fp-error/5 px-3 py-2 text-sm text-fp-error">
          {error}
        </p>
      )}

      <p className="mt-8 text-center text-xs text-fp-mid">
        {company}
        {proof.company?.phone && ` · ${proof.company.phone}`}
        {proof.company?.email && ` · ${proof.company.email}`}
      </p>
    </Shell>
  );
}
