-- Contracts on proposals (DJ, 16 November 2026).
--
-- Plain-English summary:
-- * A proposal can include a contract, like Footprint's contract builder
--   (quotes.footprintgroup.uk/contract): parties, objectives, long-term
--   solution, scope of services, pricing and payment schedule, nine terms and
--   conditions, and signatures.
-- * The customer signs it the same way they accept a quote: on their link,
--   by typing their name and accepting. Accepting the proposal signs the
--   contract (one step). At that moment a frozen copy of exactly what they
--   signed is saved, with who, when and from where; it can't be changed after.
-- * The wording of the nine clauses lives in `contract_wording` and can be
--   changed by admins and Directors only. It starts as Footprint's current
--   wording.

-- ─── Who counts as a Director ───────────────────────────────────────────────

create function public.is_director()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.profiles p on p.id = ur.user_id
     where ur.user_id = auth.uid() and p.is_active and r.name = 'Directors');
$$;
revoke execute on function public.is_director() from public, anon;
grant execute on function public.is_director() to authenticated;

-- ─── The wording ────────────────────────────────────────────────────────────

-- One row. clauses: [{ "title": "...", "body": "paragraph\n\nparagraph" }];
-- "{notice_days}" is replaced with the proposal's notice period.
create table public.contract_wording (
  id          integer primary key default 1 check (id = 1),
  clauses     jsonb not null check (jsonb_typeof(clauses) = 'array'),
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid() references public.profiles (id) on delete set null
);
create index contract_wording_updated_by_idx on public.contract_wording (updated_by);

alter table public.contract_wording enable row level security;
create policy "Staff read the contract wording" on public.contract_wording for select to authenticated using (true);
create policy "Admins and Directors change the contract wording" on public.contract_wording for update to authenticated
  using ((select public.is_admin()) or (select public.is_director()))
  with check ((select public.is_admin()) or (select public.is_director()));
grant select, update on public.contract_wording to authenticated;
revoke all on public.contract_wording from anon;

create trigger contract_wording_touch before update on public.contract_wording
  for each row execute function public.touch_row();
create trigger audit_contract_wording after insert or update or delete on public.contract_wording
  for each row execute function public.audit_row();

insert into public.contract_wording (id, clauses) values (1, $json$[
  {"title": "Services Rendered", "body": "Footprint Group will deliver the services set out in the Scope of Services above. Where the first payment includes any set-up fee and the first month's subscription fee, this is reflected in the Payment Schedule.\n\nWe can't guarantee our work will be error-free. We are not liable to you or any third party for lost profits, lost savings, or other incidental, consequential or special damages, even where we've been advised such damages were possible."},
  {"title": "Mutual Cooperation", "body": "We will use our best efforts to fulfil and exceed your expectations on the deliverables above. You agree to make available to us the information needed for the project and to cooperate with us in expediting the work."},
  {"title": "Charges for Out-of-Scope Work", "body": "Requests beyond what's listed in this Agreement may be considered out-of-scope, and we'll recommend a written amendment before proceeding. Projects that go dormant for longer than 45 days may incur a fee to resume work, at our discretion."},
  {"title": "Terms of Payment", "body": "Payments follow the Payment Schedule above. Monthly subscription services require sign-up to our Direct Debit platform before the project starts; details are sent as part of onboarding once this Agreement is signed. We will invoice within 5 working days of receiving the signed Agreement.\n\nThe first invoice is due on receipt. Every invoice after that carries 15-day payment terms. Late payment incurs a fee of 1% per month on any overdue, undisputed balance, and we reserve the right to pause work until payment is received."},
  {"title": "Cancellation of Plans", "body": "You may modify, reject, cancel or stop any plan or work in progress within 14 days of the date you sign this Agreement. You agree to reimburse us for costs and expenses already incurred that relate to non-cancellable commitments made prior to your instruction to change course. We will use our best efforts to minimise such costs."},
  {"title": "Responsibilities & Ownership", "body": "You guarantee that all text, images or other artwork you provide are either owned by you or that you have permission to use them. Once final payment has cleared: you own the visual elements we create for this project (we'll provide source and finished files); you retain ownership of all text, images and data you provided. We own the unique combination of these elements as a complete design, which we license to you exclusively and in perpetuity for this project.\n\nYou are responsible for the accuracy, completeness and propriety of information you provide to us in connection with this Agreement."},
  {"title": "Confidentiality", "body": "We will use all reasonable efforts, both during and after this engagement, to preserve the confidentiality of any proprietary or confidential information you disclose to us."},
  {"title": "Term & Termination", "body": "This Agreement becomes effective on the date it is signed and continues until terminated by either party upon not less than {notice_days} days' written notice. Either party may terminate for cause if the other defaults on a material obligation and fails to rectify it within 30 days of notice, or immediately in the event of insolvency.\n\nAny non-cancellable materials or services we've committed to on your behalf must be paid for in full. If, on termination, any materials or services remain unpaid, you agree not to use them until payment is made in full. Provided no balance is outstanding, we will transfer all your property and materials in our possession to you, at your cost."},
  {"title": "General Provisions", "body": "This Agreement is governed by the laws of England and Wales. Both parties confirm they have full authority to enter into and perform this Agreement. This Agreement constitutes the entire understanding between the parties on this subject matter and supersedes all prior discussions. If any provision is found invalid or unenforceable, the remainder of the Agreement continues in full force."}
]$json$::jsonb);

-- ─── The contract on a proposal ─────────────────────────────────────────────

alter table public.sales_documents
  add column contract_enabled         boolean not null default false,
  add column contract_objectives      text check (contract_objectives is null or length(contract_objectives) <= 5000),
  add column contract_longterm        text check (contract_longterm is null or length(contract_longterm) <= 5000),
  add column contract_start_date      date,
  add column contract_notice_days     integer check (contract_notice_days is null or contract_notice_days between 1 and 365),
  add column contract_signatory_name  text check (contract_signatory_name is null or length(contract_signatory_name) <= 200),
  add column contract_signatory_title text check (contract_signatory_title is null or length(contract_signatory_title) <= 200),
  add column contract_signed_at       timestamptz,
  add column contract_snapshot        jsonb;

-- Everything the contract shows, from the document as it is now. Runs with the
-- caller's rights, so staff only see contracts on documents they can see; the
-- public link and the signing trigger call it from trusted functions.
create function public.contract_json(p_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'quote_number', d.number,
    'issue_date', d.issue_date,
    'client', c.name,
    'footprint_rep', coalesce(o.full_name, (select s.company_name from public.company_settings s limit 1), 'Footprint Group'),
    'start_date', d.contract_start_date,
    'notice_days', coalesce(d.contract_notice_days, 30),
    'objectives', coalesce((select jsonb_agg(trim(x)) from regexp_split_to_table(coalesce(d.contract_objectives, ''), E'\n') x where trim(x) <> ''), '[]'::jsonb),
    'longterm', coalesce((select jsonb_agg(trim(x)) from regexp_split_to_table(coalesce(d.contract_longterm, ''), E'\n') x where trim(x) <> ''), '[]'::jsonb),
    'signatory_name', coalesce(nullif(trim(d.contract_signatory_name), ''), nullif(trim(concat_ws(' ', ct.first_name, ct.last_name)), '')),
    'signatory_title', nullif(trim(d.contract_signatory_title), ''),
    'plan_months', d.plan_months,
    'deposit_percent', coalesce(d.deposit_percent, 0),
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
                'description', l.description, 'quantity', l.quantity, 'unit_price', l.unit_price,
                'discount_percent', l.discount_percent, 'line_net', l.line_net, 'tax_rate', l.tax_rate,
                'billing', coalesce(l.billing, 'oneoff')) order by l.position)
              from public.sales_document_lines l where l.document_id = d.id), '[]'::jsonb),
    'clauses', coalesce((select jsonb_agg(jsonb_build_object(
                  'title', cl ->> 'title',
                  'body', replace(cl ->> 'body', '{notice_days}', coalesce(d.contract_notice_days, 30)::text)) order by n)
                from public.contract_wording w, jsonb_array_elements(w.clauses) with ordinality as e(cl, n)), '[]'::jsonb))
  from public.sales_documents d
  left join public.customers c on c.id = d.customer_id
  left join public.contacts ct on ct.id = d.contact_id
  left join public.profiles o on o.id = d.owner_id
  where d.id = p_id;
$$;
revoke execute on function public.contract_json(uuid) from public, anon;
grant execute on function public.contract_json(uuid) to authenticated;

-- Sign on online acceptance (one step), and keep a signed contract unchanged.
create function public.sales_document_contract()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.contract_signed_at is not null and (
       (new.contract_enabled, new.contract_objectives, new.contract_longterm, new.contract_start_date, new.contract_notice_days,
        new.contract_signatory_name, new.contract_signatory_title, new.contract_signed_at, new.contract_snapshot)
       is distinct from
       (old.contract_enabled, old.contract_objectives, old.contract_longterm, old.contract_start_date, old.contract_notice_days,
        old.contract_signatory_name, old.contract_signatory_title, old.contract_signed_at, old.contract_snapshot)) then
    raise exception 'This contract has been signed and can''t be changed';
  end if;
  if new.doc_type = 'quote' and new.contract_enabled and new.contract_signed_at is null
     and old.status = 'sent' and new.status = 'accepted'
     and old.responded_at is null and new.responded_at is not null then
    new.contract_signed_at := new.responded_at;
    new.contract_snapshot := public.contract_json(new.id) || jsonb_build_object(
      'signed_by', new.response_name,
      'signed_at', new.responded_at,
      'signed_ip', new.response_ip,
      'customer_po', new.response_po);
  end if;
  return new;
end;
$$;
revoke execute on function public.sales_document_contract() from public, anon, authenticated;
create trigger sales_documents_contract before update on public.sales_documents
  for each row execute function public.sales_document_contract();

-- The contract for the customer's link: the signed copy once signed, else the
-- contract as it stands. Null when the proposal has no contract.
create function public.contract_by_token(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  d public.sales_documents%rowtype;
begin
  select * into d from public.sales_documents where public_token = p_token and doc_type = 'quote';
  if d.id is null or not d.contract_enabled then
    return null;
  end if;
  if d.contract_signed_at is not null then
    return d.contract_snapshot || jsonb_build_object('signed', true);
  end if;
  return public.contract_json(d.id) || jsonb_build_object('signed', false);
end;
$$;
revoke execute on function public.contract_by_token(uuid) from public;
grant execute on function public.contract_by_token(uuid) to anon, authenticated;
