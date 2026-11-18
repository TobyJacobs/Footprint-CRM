-- Magazine content library (9 November 2026).
--
-- Plain-English summary:
-- * Magazines → Content holds everything ready to fill pages not sold as
--   adverts: puzzles (word searches and sudoku) and articles.
-- * A puzzle can now be made as a draft (no issue yet) and used in as many
--   issues as needed, e.g. the same word search in all 11 editions in a month.
--   In each issue it takes two spots: the puzzle and its answers, on
--   different pages.
-- * Articles are free ones only: from GOV.UK (free to reuse under the Open
--   Government Licence, with its credit line) or written by the team. Each
--   can be put on the flatplan of any issue.
-- * Seeing the library needs Magazines view; changing it needs Magazines edit.

-- ─── Puzzles: drafts, and used in many issues ───────────────────────────────
alter table public.magazine_puzzles alter column issue_id drop not null;

drop index public.magazine_flatplan_items_puzzle_part_idx;
create unique index magazine_flatplan_items_puzzle_part_idx
  on public.magazine_flatplan_items (puzzle_id, issue_id, puzzle_part) where puzzle_id is not null;

-- In each issue, a puzzle's answers aren't on the same page as the puzzle.
create or replace function public.check_puzzle_item()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.puzzle_id is null then
    return new;
  end if;
  if exists (select 1 from public.magazine_flatplan_items
              where puzzle_id = new.puzzle_id and issue_id = new.issue_id and puzzle_part <> new.puzzle_part
                and page = new.page and id <> new.id) then
    raise exception 'Put the answers on a different page from the puzzle';
  end if;
  return new;
end;
$$;

-- ─── Articles ───────────────────────────────────────────────────────────────
create table public.magazine_articles (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(trim(title)) between 1 and 200),
  body         text not null check (length(body) between 1 and 30000),
  source       text not null check (source in ('own', 'govuk')),
  source_url   text check (source_url is null or source_url ~ '^https://www\.gov\.uk/'),
  credit       text check (credit is null or length(credit) <= 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  -- GOV.UK articles keep their link and the licence's credit line.
  check (source = 'own' or (source_url is not null and credit is not null))
);

alter table public.magazine_flatplan_items
  add column article_id uuid references public.magazine_articles (id) on delete cascade,
  add constraint magazine_flatplan_items_article_check
    check (article_id is null or (line_id is null and puzzle_id is null));
create index magazine_flatplan_items_article_idx on public.magazine_flatplan_items (article_id) where article_id is not null;

alter table public.magazine_articles enable row level security;
create policy "View articles" on public.magazine_articles for select to authenticated
  using ((select public.has_permission('magazines', 'view')));
create policy "Change articles" on public.magazine_articles for all to authenticated
  using ((select public.has_permission('magazines', 'edit'))) with check ((select public.has_permission('magazines', 'edit')));
create trigger magazine_articles_touch before update on public.magazine_articles
  for each row execute function public.touch_row();
create trigger audit_magazine_articles after insert or update or delete on public.magazine_articles
  for each row execute function public.audit_row();
