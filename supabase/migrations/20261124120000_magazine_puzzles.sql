-- Magazine puzzles (9 November 2026).
--
-- Plain-English summary:
-- * FootprintOS makes word searches and sudoku for pages not sold as adverts
--   (lib/puzzles). Each puzzle belongs to one issue and is saved as made, so
--   the puzzle and its answers always match.
-- * A puzzle takes two spots on the issue's flatplan: the puzzle itself and
--   its answers, which go on a different page of the same issue (the back
--   page unless someone picks another). Deleting the puzzle removes both.
-- * Seeing puzzles needs Magazines view; making and changing them needs
--   Magazines edit (as for the flatplan).

create table public.magazine_puzzles (
  id          uuid primary key default gen_random_uuid(),
  issue_id    uuid not null references public.magazine_issues (id) on delete cascade,
  kind        text not null check (kind in ('wordsearch', 'sudoku')),
  title       text not null check (length(trim(title)) between 1 and 120),
  difficulty  text not null check (difficulty in ('easy', 'medium', 'hard')),
  seed        bigint not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create index magazine_puzzles_issue_idx on public.magazine_puzzles (issue_id);

alter table public.magazine_flatplan_items
  add column puzzle_id   uuid references public.magazine_puzzles (id) on delete cascade,
  add column puzzle_part text check (puzzle_part in ('puzzle', 'answers')),
  add constraint magazine_flatplan_items_puzzle_check
    check ((puzzle_id is null and puzzle_part is null) or (puzzle_id is not null and puzzle_part is not null and line_id is null));
create unique index magazine_flatplan_items_puzzle_part_idx on public.magazine_flatplan_items (puzzle_id, puzzle_part) where puzzle_id is not null;

-- A puzzle's spots are on its own issue's flatplan, and its answers aren't on
-- the same page as the puzzle.
create function public.check_puzzle_item()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.puzzle_id is null then
    return new;
  end if;
  if not exists (select 1 from public.magazine_puzzles where id = new.puzzle_id and issue_id = new.issue_id) then
    raise exception 'That puzzle isn''t in this issue';
  end if;
  if exists (select 1 from public.magazine_flatplan_items
              where puzzle_id = new.puzzle_id and puzzle_part <> new.puzzle_part and page = new.page and id <> new.id) then
    raise exception 'Put the answers on a different page from the puzzle';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_puzzle_item() from anon, authenticated, public;
create trigger magazine_flatplan_items_puzzle before insert or update on public.magazine_flatplan_items
  for each row execute function public.check_puzzle_item();

alter table public.magazine_puzzles enable row level security;
create policy "View puzzles" on public.magazine_puzzles for select to authenticated
  using ((select public.has_permission('magazines', 'view')));
create policy "Change puzzles" on public.magazine_puzzles for all to authenticated
  using ((select public.has_permission('magazines', 'edit'))) with check ((select public.has_permission('magazines', 'edit')));
create trigger magazine_puzzles_touch before update on public.magazine_puzzles
  for each row execute function public.touch_row();
create trigger audit_magazine_puzzles after insert or update or delete on public.magazine_puzzles
  for each row execute function public.audit_row();
