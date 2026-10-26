import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Badge, Card, Notice, dangerButton, inputClass, primaryButton, secondaryButton } from "@/components/ui";
import { getCurrentUser, requirePermission } from "@/lib/auth";
import { longDate, shortDateTime } from "@/lib/customers/display";
import { loadJobFiles, loadPeople, type JobFile } from "@/lib/design/jobs";
import { daysSince, designStageLabel, designStageTone, designStages, isDesignStage, jobNumber, nextStage } from "@/lib/design/options";
import { todayIso } from "@/lib/projects/options";
import { createClient } from "@/lib/supabase/server";
import { addNote, deleteFile, deleteJob, deleteNote, saveJob, setJobStage } from "../actions";
import JobForm from "../JobForm";
import { DueDate, PriorityFlag } from "../parts";
import ApprovalCard, { type ApprovalRow } from "./ApprovalCard";
import FileUploader from "./FileUploader";

export const metadata: Metadata = { title: "Design job" };

const size = (n: number | null) => (n === null ? "" : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function DesignJobPage(props: PageProps<"/design/[id]">) {
  await requirePermission("design", "view");
  const user = await getCurrentUser();
  const canEdit = user.can("design", "edit");
  const canDelete = user.can("design", "delete");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await props.searchParams;
  const today = todayIso();
  const supabase = await createClient();

  const [{ data: job }, { pickable, nameOf }, files, { data: notes }, { data: approvalRows }, { data: settings }] = await Promise.all([
    supabase
      .from("design_jobs")
      .select(
        "id, number, title, brief, stage, due_date, high_priority, designer_id, requested_by, stage_changed_at, completed_at, created_at, customer_id, customers(id, name), sales_order:sales_documents(id, number, title), project:projects(id, number, name)",
      )
      .eq("id", id)
      .maybeSingle(),
    loadPeople(supabase),
    loadJobFiles(supabase, id),
    supabase.from("design_job_notes").select("id, body, author_id, from_customer, created_at").eq("job_id", id).order("created_at"),
    supabase
      .from("design_proof_approvals")
      .select("id, token, sent_to, status, expires_at, created_at, response_name, response_note, responded_at, file:design_job_files(version)")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("company_settings").select("company_name").maybeSingle(),
  ]);
  if (!job) notFound();
  // The customer's main contact, to pre-fill the approval email.
  const { data: contact } = job.customer_id
    ? await supabase
        .from("contacts")
        .select("first_name, email")
        .eq("customer_id", job.customer_id)
        .not("email", "is", null)
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const origin = await siteUrl();
  const approvals: ApprovalRow[] = (approvalRows ?? []).map((a) => ({
    id: a.id as string,
    token: a.token as string,
    version: (a.file as unknown as { version: number | null } | null)?.version ?? null,
    sent_to: a.sent_to as string,
    status: a.status as string,
    expires_at: a.expires_at as string,
    created_at: a.created_at as string,
    response_name: a.response_name as string | null,
    response_note: a.response_note as string | null,
    responded_at: a.responded_at as string | null,
  }));
  const customer = job.customers as unknown as { id: string; name: string } | null;
  const order = job.sales_order as unknown as { id: string; number: string; title: string | null } | null;
  const project = job.project as unknown as { id: string; number: string; name: string } | null;
  const proofs = files.filter((f) => f.kind === "proof");
  const briefFiles = files.filter((f) => f.kind === "brief");
  const latest = proofs[0] ?? null;
  const next = isDesignStage(job.stage) ? nextStage[job.stage] : undefined;
  const daysInStage = daysSince(job.stage_changed_at);

  return (
    <div className="grid gap-6">
      <Link href="/design" className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Design board
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-fp-mid">{jobNumber(job.number)}</p>
          <h2 className="text-2xl font-black">{job.title}</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge tone={designStageTone(job.stage)}>{designStageLabel(job.stage)}</Badge>
            <span className="text-fp-mid">
              {job.stage === "done" && job.completed_at
                ? `Finished ${shortDateTime(job.completed_at)}`
                : `${daysInStage === 0 ? "Since today" : `${daysInStage} day${daysInStage === 1 ? "" : "s"} at this stage`}`}
            </span>
            <PriorityFlag on={job.high_priority} />
            <DueDate job={job} today={today} />
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {next && (
              <form action={setJobStage.bind(null, job.id)}>
                <input type="hidden" name="stage" value={next} />
                <button type="submit" className={primaryButton}>
                  Move to {designStageLabel(next)} →
                </button>
              </form>
            )}
            {job.stage === "with_customer" && (
              <form action={setJobStage.bind(null, job.id)}>
                <input type="hidden" name="stage" value="amends" />
                <button type="submit" className={secondaryButton}>
                  Customer wants changes
                </button>
              </form>
            )}
            <form action={setJobStage.bind(null, job.id)} className="flex items-center gap-2">
              <label className="sr-only" htmlFor="stage-pick">
                Move to stage
              </label>
              <select id="stage-pick" name="stage" defaultValue={job.stage} className={`${inputClass} w-auto`}>
                {designStages.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button type="submit" className={secondaryButton}>
                Set stage
              </button>
            </form>
          </div>
        )}
      </div>

      <Notice searchParams={sp} />
      {(sp.emailed === "sent" || sp.emailed === "test" || sp.linkmade) && (
        <p role="status" className="rounded-md border border-fp-teal-deep/30 bg-fp-teal/10 px-4 py-3 text-sm text-fp-teal-deep">
          {sp.linkmade
            ? "Approval link made. Copy it from Customer approval below."
            : sp.emailed === "test"
              ? "Proof sent in test mode (not actually delivered)."
              : "Proof emailed to the customer for approval."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          <Card title="Brief">
            {job.brief ? <p className="whitespace-pre-line text-sm">{job.brief}</p> : <p className="text-sm text-fp-mid">No brief written yet.</p>}
            {briefFiles.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-fp-mid">Brief files</h3>
                <FileList files={briefFiles} jobId={job.id} canDelete={canDelete} nameOf={nameOf} />
              </div>
            )}
          </Card>

          <section id="files">
            <Card title={proofs.length ? `Proofs (latest: v${latest?.version})` : "Proofs"}>
              {latest?.url && latest.isImage && (
                <a href={latest.url} target="_blank" rel="noopener noreferrer" className="mb-4 block">
                  {/* Signed links expire, so a plain img (not next/image) is right here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={latest.url} alt={`Proof v${latest.version}`} className="max-h-96 rounded-md border border-fp-border object-contain" />
                </a>
              )}
              {proofs.length > 0 ? (
                <FileList files={proofs} jobId={job.id} canDelete={canDelete} nameOf={nameOf} />
              ) : (
                <p className="mb-4 text-sm text-fp-mid">No proofs uploaded yet.</p>
              )}
              <div className="mt-4">
                <FileUploader jobId={job.id} canAddProof={canEdit} />
              </div>
            </Card>
          </section>

          <ApprovalCard
            jobId={job.id}
            jobNumber={job.number}
            jobTitle={job.title}
            latestVersion={latest?.version ?? null}
            canEdit={canEdit}
            contactEmail={(contact?.email as string | null) ?? null}
            contactFirstName={(contact?.first_name as string | null) ?? null}
            senderName={user.fullName ?? user.email}
            companyName={settings?.company_name ?? "Footprint Group"}
            origin={origin}
            approvals={approvals}
          />

          <section id="notes">
            <Card title={`Notes (${(notes ?? []).length})`}>
              {(notes ?? []).length > 0 ? (
                <ul className="mb-4 grid gap-3">
                  {(notes ?? []).map((n) => (
                    <li key={n.id} className="rounded-md bg-fp-offwhite p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-fp-mid">
                        <span>
                          <strong className="text-fp-dark">
                            {n.from_customer ? "Customer (online)" : n.author_id ? nameOf.get(n.author_id) ?? "Someone" : "Someone"}
                          </strong>{" "}
                          · {shortDateTime(n.created_at)}
                        </span>
                        {(n.author_id === user.id || canDelete) && (
                          <form action={deleteNote.bind(null, job.id, n.id)}>
                            <ConfirmSubmit message="Delete this note?" className="text-xs font-semibold text-fp-error hover:underline">
                              Delete
                            </ConfirmSubmit>
                          </form>
                        )}
                      </div>
                      <p className="whitespace-pre-line">{n.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-4 text-sm text-fp-mid">No notes yet.</p>
              )}
              <form action={addNote.bind(null, job.id)} className="grid gap-2">
                <label className="sr-only" htmlFor="note-body">
                  Add a note
                </label>
                <textarea id="note-body" name="body" rows={3} required maxLength={5000} placeholder="Add a note: customer feedback, questions, what's next…" className={inputClass} />
                <div>
                  <button type="submit" className={secondaryButton}>
                    Add note
                  </button>
                </div>
              </form>
            </Card>
          </section>
        </div>

        <div className="grid content-start gap-6">
          <Card title="Linked to">
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-xs font-semibold text-fp-mid">Customer</dt>
                <dd>
                  {customer ? (
                    <Link href={`/customers/${customer.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                      {customer.name}
                    </Link>
                  ) : (
                    "Footprint (internal)"
                  )}
                </dd>
              </div>
              {order && (
                <div>
                  <dt className="text-xs font-semibold text-fp-mid">Sales order</dt>
                  <dd>
                    <Link href={`/sales/${order.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                      {order.number}
                    </Link>
                    {order.title ? ` · ${order.title}` : ""}
                  </dd>
                </div>
              )}
              {project && (
                <div>
                  <dt className="text-xs font-semibold text-fp-mid">Project</dt>
                  <dd>
                    <Link href={`/projects/${project.id}`} className="font-semibold text-fp-teal-deep hover:underline">
                      {project.number}
                    </Link>{" "}
                    · {project.name}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold text-fp-mid">Asked for by</dt>
                <dd>
                  {job.requested_by ? nameOf.get(job.requested_by) ?? "—" : "—"} on {longDate(job.created_at)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title={canEdit ? "Details" : "Details (view only)"}>
            {canEdit ? (
              <JobForm
                action={saveJob.bind(null, job.id)}
                people={pickable}
                values={{
                  title: job.title,
                  brief: job.brief,
                  customer,
                  designer_id: job.designer_id,
                  due_date: job.due_date,
                  high_priority: job.high_priority,
                  stage: job.stage,
                }}
                canSetStage
                submitLabel="Save changes"
              />
            ) : (
              <>
                <dl className="grid gap-2 text-sm">
                  <dt className="text-xs font-semibold text-fp-mid">Designer</dt>
                  <dd>{job.designer_id ? nameOf.get(job.designer_id) ?? "—" : "Not assigned yet"}</dd>
                  <dt className="text-xs font-semibold text-fp-mid">Due date</dt>
                  <dd>{job.due_date ? longDate(job.due_date) : "None"}</dd>
                </dl>
                <p className="mt-3 text-xs text-fp-mid">The design team can change these. You can still add notes and brief files.</p>
              </>
            )}
          </Card>

          {canDelete && (
            <form action={deleteJob.bind(null, job.id)}>
              <ConfirmSubmit message={`Delete design job ${jobNumber(job.number)} with its files and notes?`} className={dangerButton}>
                Delete job
              </ConfirmSubmit>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function FileList({ files, jobId, canDelete, nameOf }: { files: JobFile[]; jobId: string; canDelete: boolean; nameOf: Map<string, string> }) {
  return (
    <ul className="grid gap-2 text-sm">
      {files.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-fp-border px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText size={16} aria-hidden className="shrink-0 text-fp-mid" />
            <div className="min-w-0">
              <p className="truncate">
                {f.version !== null && <strong className="mr-1">v{f.version}</strong>}
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-fp-teal-deep hover:underline">
                    {f.name}
                  </a>
                ) : (
                  f.name
                )}{" "}
                <span className="text-xs text-fp-mid">{size(f.size)}</span>
              </p>
              <p className="text-xs text-fp-mid">
                {f.uploadedBy ? nameOf.get(f.uploadedBy) ?? "Someone" : "Someone"}, {shortDateTime(f.createdAt)}
                {f.note ? ` · ${f.note}` : ""}
              </p>
            </div>
          </div>
          {canDelete && (
            <form action={deleteFile.bind(null, jobId, f.id)}>
              <ConfirmSubmit message={`Delete ${f.name}?`} className="text-xs font-semibold text-fp-error hover:underline">
                Delete
              </ConfirmSubmit>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
