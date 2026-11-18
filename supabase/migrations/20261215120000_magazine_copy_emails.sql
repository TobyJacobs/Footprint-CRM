-- Email advertisers their copy (owner, 16 November 2026; magazine reports 4).
--
-- Plain-English summary:
-- * No posted complimentary or voucher copies. Instead, once an issue's online
--   flipbook is published, each advertiser in it can be emailed a link to read
--   it and the page their advert is on.
-- * This records who was emailed for which issue, so nobody gets it twice.
--   The email itself also goes in the customer's email history.

create table public.magazine_copy_emails (
  id           uuid primary key default gen_random_uuid(),
  issue_id     uuid not null references public.magazine_issues (id) on delete cascade,
  customer_id  uuid not null references public.customers (id) on delete cascade,
  to_address   text not null check (length(to_address) <= 320),
  status       text not null check (status in ('sent', 'failed', 'test')),
  error        text check (error is null or length(error) <= 1000),
  sent_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  sent_at      timestamptz not null default now()
);
create index magazine_copy_emails_issue_idx on public.magazine_copy_emails (issue_id, customer_id);
create index magazine_copy_emails_customer_idx on public.magazine_copy_emails (customer_id);
create index magazine_copy_emails_sent_by_idx on public.magazine_copy_emails (sent_by);

alter table public.magazine_copy_emails enable row level security;
create policy "See copy emails" on public.magazine_copy_emails for select to authenticated
  using ((select public.has_permission('magazines', 'view')));
create policy "Record copy emails" on public.magazine_copy_emails for insert to authenticated
  with check ((select public.has_permission('magazines', 'edit')));
grant select, insert on public.magazine_copy_emails to authenticated;
revoke all on public.magazine_copy_emails from anon;

create trigger audit_magazine_copy_emails after insert or update or delete on public.magazine_copy_emails
  for each row execute function public.audit_row();
