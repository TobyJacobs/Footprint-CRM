-- AI control room, part 2 (owner, 18 November 2026).
--
-- Plain-English summary:
-- * Everyone on the FootprintAI list can connect their own bots, not just
--   admins. Each bot has an owner, who (with admins) can change it and make
--   its key. Giving a bot the Quotes skill needs permission to make quotes.
-- * An outside bot can have its own web address: FootprintOS then sends it
--   messages from the control room and group chats, so everyone can use it.
-- * Group chats: a person picks two or more bots and starts a conversation;
--   the bots take turns to reply and people can join in. Every FootprintAI
--   member can see and join every group chat.

alter table public.ai_bots
  add column owner_id uuid references public.profiles (id) on delete set null default auth.uid(),
  add column webhook_url text check (webhook_url is null or (webhook_url ~ '^https://[^\s/@]+(/[^\s]*)?$' and length(webhook_url) <= 500)),
  add column description text check (description is null or length(description) <= 300);
create index ai_bots_owner_idx on public.ai_bots (owner_id);

drop policy "Admins add bots" on public.ai_bots;
drop policy "Admins change bots" on public.ai_bots;
drop policy "Admins delete bots" on public.ai_bots;
create policy "Members add their own bots" on public.ai_bots for insert to authenticated
  with check (public.is_ai_member() and (owner_id = (select auth.uid()) or public.is_admin()));
create policy "Owners and admins change bots" on public.ai_bots for update to authenticated
  using (public.is_ai_member() and (owner_id = (select auth.uid()) or public.is_admin()))
  with check (public.is_ai_member() and (owner_id = (select auth.uid()) or public.is_admin()));
create policy "Owners and admins delete bots" on public.ai_bots for delete to authenticated
  using (public.is_ai_member() and (owner_id = (select auth.uid()) or public.is_admin()));

-- Only admins and people who can make quotes can give a bot the Quotes skill.
create function public.ai_bot_skill_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and 'quotes' = any (new.skills)
     and (tg_op = 'INSERT' or not ('quotes' = any (old.skills)))
     and not (public.is_admin() or public.has_permission('quotes', 'edit')) then
    raise exception 'Only people who can make quotes can give a bot the Quotes skill';
  end if;
  return new;
end;
$$;
revoke execute on function public.ai_bot_skill_check() from public, anon, authenticated;
create trigger ai_bots_skill_check before insert or update on public.ai_bots
  for each row execute function public.ai_bot_skill_check();

-- Runs: outside bots with a web address can now be asked from the control room.
drop policy "Members ask an in-house bot" on public.ai_bot_runs;
create policy "Members ask a bot" on public.ai_bot_runs for insert to authenticated
  with check (
    public.is_ai_member() and requested_by = (select auth.uid()) and source = 'control_room'
    and status = 'running' and steps = '[]'::jsonb and draft_ids = '{}' and turns = 0
    and exists (select 1 from public.ai_bots b where b.id = bot_id and b.active
                  and (b.engine in ('claude', 'grok') or b.webhook_url is not null))
  );

-- An outside bot asked from the control room may use its tools on that run
-- with its key (outside_bot_tool), as well as on runs it started itself.
create or replace function public.outside_bot_tool(p_key text, p_run uuid, p_request text, p_tool text, p_input jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_bot public.ai_bots%rowtype;
  v_run uuid := p_run;
begin
  if p_key is null or length(p_key) < 32 then
    raise exception 'Not allowed';
  end if;
  select b.* into v_bot from public.ai_bot_keys k join public.ai_bots b on b.id = k.bot_id
   where k.key_hash = public._portal_hash(p_key) and b.engine = 'outside' and b.active;
  if v_bot.id is null then
    raise exception 'Not allowed';
  end if;
  if (select coalesce(sum(jsonb_array_length(r.steps)), 0) from public.ai_bot_runs r
       where r.bot_id = v_bot.id and r.created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Too many requests';
  end if;
  if v_run is null then
    insert into public.ai_bot_runs (bot_id, source, requested_by, request)
    values (v_bot.id, 'outside', null, coalesce(nullif(left(trim(coalesce(p_request, '')), 4000), ''), '(The bot didn''t say)'))
    returning id into v_run;
  elsif not exists (select 1 from public.ai_bot_runs where id = v_run and bot_id = v_bot.id) then
    raise exception 'Run not found';
  end if;
  return jsonb_build_object('run_id', v_run, 'result', public._ai_bot_do(v_run, p_tool, p_input));
end;
$$;

-- Making a key: the bot's owner or an admin.
create or replace function public.set_ai_bot_key(p_bot uuid, p_key text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.ai_bots where id = p_bot and engine = 'outside'
                   and public.is_ai_member() and (owner_id = auth.uid() or public.is_admin())) then
    raise exception 'Only the bot''s owner or an admin can make its key';
  end if;
  if p_key is null or length(p_key) < 32 then
    raise exception 'That key is too short';
  end if;
  insert into public.ai_bot_keys (bot_id, key_hash, hint)
  values (p_bot, public._portal_hash(p_key), right(p_key, 4))
  on conflict (bot_id) do update set key_hash = excluded.key_hash, hint = excluded.hint, created_at = now(), created_by = auth.uid();
end;
$$;


-- Whether a given person (not necessarily the one signed in) has a permission:
-- used when an outside bot works on a request someone made in the control room.
create function public._ai_user_can(p_user uuid, p_feature text, p_action text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = p_user and p.is_active and p.is_admin)
      or exists (select 1 from public.user_roles ur
                   join public.role_permissions rp on rp.role_id = ur.role_id
                   join public.profiles p on p.id = ur.user_id
                  where ur.user_id = p_user and p.is_active and rp.feature = p_feature and rp.action = p_action);
$$;
revoke execute on function public._ai_user_can(uuid, text, text) from public, anon, authenticated;

-- The bots' tools, as before, but the Quotes permission is checked against
-- the person who asked (so it also works when an outside bot does the work).
create or replace function public._ai_bot_do(p_run uuid, p_tool text, p_input jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  run public.ai_bot_runs%rowtype;
  bot public.ai_bots%rowtype;
  v_input jsonb := coalesce(p_input, '{}'::jsonb);
  v_q text;
  v_result jsonb;
  v_summary text;
  v_customer public.customers%rowtype;
  v_contact uuid;
  v_tax public.tax_rates%rowtype;
  v_quote uuid;
  v_number text;
  v_pos integer := 0;
  v_line jsonb;
  v_product public.products%rowtype;
  v_qty numeric;
  v_price numeric;
  v_desc text;
  v_unit text;
  v_probability text;
  v_expected text;
begin
  select * into run from public.ai_bot_runs where id = p_run for update;
  select * into bot from public.ai_bots where id = run.bot_id;
  if run.id is null or run.status <> 'running' then
    raise exception 'This run has finished';
  end if;
  if run.created_at < now() - interval '1 hour' then
    raise exception 'This run is over an hour old: please start a new one';
  end if;
  if jsonb_array_length(run.steps) >= 40 then
    raise exception 'This run has used all its steps';
  end if;
  if p_tool in ('find_customers', 'find_products', 'recent_orders', 'create_draft_quote') and not ('quotes' = any (bot.skills)) then
    raise exception 'This bot isn''t allowed to do quotes';
  end if;
  if jsonb_typeof(v_input) <> 'object' then
    raise exception 'The tool''s details must be an object';
  end if;

  if p_tool = 'find_customers' then
    v_q := left(trim(coalesce(v_input ->> 'query', '')), 100);
    if length(v_q) < 2 then
      raise exception 'Please search with at least 2 letters';
    end if;
    select coalesce(jsonb_agg(c), '[]'::jsonb) into v_result from (
      select c.id, c.name, c.email, c.billing_city as town,
             (select max(d.issue_date) from public.sales_documents d where d.customer_id = c.id and d.doc_type in ('sales_order', 'invoice')) as last_order
        from public.customers c
       where c.erased_at is null
         and (c.name ilike '%' || v_q || '%' or c.email ilike '%' || v_q || '%')
       order by (lower(c.name) = lower(v_q)) desc, (c.name ilike v_q || '%') desc, c.name
       limit 8) c;
    v_summary := 'Looked for customers matching "' || v_q || '": ' || jsonb_array_length(v_result) || ' found';

  elsif p_tool = 'find_products' then
    v_q := left(trim(coalesce(v_input ->> 'query', '')), 100);
    if length(v_q) < 2 then
      raise exception 'Please search with at least 2 letters';
    end if;
    select coalesce(jsonb_agg(p), '[]'::jsonb) into v_result from (
      select p.id, p.name, p.sku as code, p.unit, p.sale_price as price, p.billing, p.category, left(p.description, 300) as description
        from public.products p
       where p.active
         and (p.name ilike '%' || v_q || '%' or p.sku ilike '%' || v_q || '%' or p.category ilike '%' || v_q || '%' or p.description ilike '%' || v_q || '%')
       order by (p.name ilike '%' || v_q || '%') desc, p.name
       limit 12) p;
    v_summary := 'Looked for products matching "' || v_q || '": ' || jsonb_array_length(v_result) || ' found';

  elsif p_tool = 'recent_orders' then
    select * into v_customer from public.customers where id = nullif(v_input ->> 'customer_id', '')::uuid and erased_at is null;
    if v_customer.id is null then
      raise exception 'Customer not found';
    end if;
    select coalesce(jsonb_agg(o), '[]'::jsonb) into v_result from (
      select d.number, d.doc_type as type, d.status, d.issue_date as date, d.title, d.total,
             (select coalesce(jsonb_agg(jsonb_build_object('product_id', l.product_id, 'description', left(l.description, 200),
                                                           'quantity', l.quantity, 'unit_price', l.unit_price) order by l.position), '[]'::jsonb)
                from (select * from public.sales_document_lines l where l.document_id = d.id order by l.position limit 15) l) as lines
        from public.sales_documents d
       where d.customer_id = v_customer.id and d.doc_type in ('quote', 'sales_order', 'invoice')
       order by d.issue_date desc nulls last, d.created_at desc
       limit 5) o;
    v_summary := 'Looked at ' || v_customer.name || '''s recent quotes and orders';

  elsif p_tool = 'create_draft_quote' then
    if coalesce(array_length(run.draft_ids, 1), 0) >= 3 then
      raise exception 'A run can make at most 3 draft quotes';
    end if;
    if run.source = 'control_room' and not public._ai_user_can(run.requested_by, 'quotes', 'edit') then
      raise exception 'The person who asked needs permission to make quotes';
    end if;
    select * into v_customer from public.customers where id = nullif(v_input ->> 'customer_id', '')::uuid and erased_at is null;
    if v_customer.id is null then
      raise exception 'Customer not found: use find_customers to get their id';
    end if;
    if jsonb_typeof(v_input -> 'lines') is distinct from 'array' or jsonb_array_length(v_input -> 'lines') = 0 or jsonb_array_length(v_input -> 'lines') > 50 then
      raise exception 'Please give between 1 and 50 lines';
    end if;
    v_probability := coalesce(nullif(v_input ->> 'probability', ''), 'Confident');
    v_expected := coalesce(nullif(v_input ->> 'expected_order', ''), 'This Month');
    if v_probability not in ('Low', 'Confident', 'Definite') then
      raise exception 'Probability must be Low, Confident or Definite';
    end if;
    if v_expected not in ('This Month', 'Next Month', 'Future') then
      raise exception 'Expected order must be This Month, Next Month or Future';
    end if;
    select * into v_tax from public.tax_rates where is_default limit 1;
    select ct.id into v_contact from public.contacts ct
     where ct.customer_id = v_customer.id and ct.erased_at is null
     order by ct.is_primary desc, ct.created_at limit 1;

    v_number := public._take_document_number('quote');
    insert into public.sales_documents (doc_type, number, status, customer_id, contact_id, owner_id, title, quote_kind,
                                        issue_date, valid_until, expected_date, probability, notes, internal_notes)
    values ('quote', v_number, 'draft', v_customer.id, v_contact,
            case when run.source = 'control_room' then run.requested_by else v_customer.owner_id end,
            nullif(left(trim(coalesce(v_input ->> 'title', '')), 200), ''), 'quote',
            (now() at time zone 'Europe/London')::date, ((now() at time zone 'Europe/London')::date + 30),
            v_expected, v_probability,
            nullif(left(trim(coalesce(v_input ->> 'notes', '')), 2000), ''),
            'Drafted by ' || bot.name || ' in the AI control room. Asked: "' || left(run.request, 500) || '". Please check before sending.')
    returning id into v_quote;

    for v_line in select * from jsonb_array_elements(v_input -> 'lines') loop
      v_product := null;
      if nullif(v_line ->> 'product_id', '') is not null then
        select * into v_product from public.products where id = (v_line ->> 'product_id')::uuid and active;
        if v_product.id is null then
          raise exception 'Product not found: use find_products to get its id';
        end if;
      end if;
      begin
        v_qty := (v_line ->> 'quantity')::numeric;
        v_price := nullif(v_line ->> 'unit_price', '')::numeric;
      exception when others then
        raise exception 'Quantities and prices must be numbers';
      end;
      if v_qty is null or v_qty <= 0 or v_qty > 1000000 then
        raise exception 'Each line needs a quantity above 0';
      end if;
      v_price := coalesce(v_price, v_product.sale_price);
      if v_price is null or v_price < 0 or v_price > 10000000 then
        raise exception 'Each line without a product needs a unit price';
      end if;
      v_desc := left(trim(coalesce(nullif(v_line ->> 'description', ''), v_product.name, '')), 500);
      if v_desc = '' then
        raise exception 'Each line needs a description';
      end if;
      insert into public.sales_document_lines (document_id, position, product_id, description, quantity, unit_price, unit_cost,
                                               discount_percent, tax_rate_id, tax_rate, billing)
      values (v_quote, v_pos, v_product.id, v_desc, v_qty, round(v_price, 2), v_product.cost_price, 0,
              coalesce(v_product.tax_rate_id, v_tax.id),
              coalesce((select r.rate from public.tax_rates r where r.id = v_product.tax_rate_id), v_tax.rate, 20),
              case when v_product.billing in ('oneoff', 'monthly') then v_product.billing else 'oneoff' end);
      if v_pos = 0 then
        v_unit := v_product.business_unit;
      end if;
      v_pos := v_pos + 1;
    end loop;
    if v_unit is not null then
      update public.sales_documents set business_unit = v_unit where id = v_quote;
    end if;

    update public.ai_bot_runs set draft_ids = draft_ids || v_quote where id = run.id;
    insert into public.customer_activity (customer_id, contact_id, kind, body)
    values (v_customer.id, v_contact, 'system', bot.name || ' drafted quote ' || v_number || ' in the AI control room (to check and send).');
    v_result := jsonb_build_object('quote_id', v_quote, 'number', v_number, 'customer', v_customer.name,
                                   'total', (select total from public.sales_documents where id = v_quote), 'status', 'draft');
    v_summary := 'Made draft quote ' || v_number || ' for ' || v_customer.name;

  elsif p_tool = 'finish' and run.source = 'outside' then
    update public.ai_bot_runs set status = 'done', finished_at = now(),
           reply = nullif(left(trim(coalesce(v_input ->> 'reply', '')), 8000), '')
     where id = run.id;
    v_result := jsonb_build_object('status', 'done');
    v_summary := 'Finished';

  else
    raise exception 'Unknown tool: %', left(coalesce(p_tool, ''), 60);
  end if;

  update public.ai_bot_runs
     set steps = steps || jsonb_build_array(jsonb_build_object('at', now(), 'tool', p_tool, 'summary', v_summary,
                                                               'input', left(v_input::text, 2000)))
   where id = run.id;
  return v_result;
end;
$$;

-- ─── Group chats ────────────────────────────────────────────────────────────

create table public.ai_chats (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) between 1 and 120),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_chats_updated_idx on public.ai_chats (updated_at desc);
create index ai_chats_created_by_idx on public.ai_chats (created_by);

create table public.ai_chat_bots (
  chat_id  uuid not null references public.ai_chats (id) on delete cascade,
  bot_id   uuid not null references public.ai_bots (id) on delete cascade,
  position integer not null default 0,
  primary key (chat_id, bot_id)
);
create index ai_chat_bots_bot_idx on public.ai_chat_bots (bot_id);

create table public.ai_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.ai_chats (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  bot_id     uuid references public.ai_bots (id) on delete set null,
  body       text not null check (length(trim(body)) between 1 and 8000),
  created_at timestamptz not null default now(),
  check (author_id is null or bot_id is null)
);
create index ai_chat_messages_chat_idx on public.ai_chat_messages (chat_id, created_at);
create index ai_chat_messages_author_idx on public.ai_chat_messages (author_id);
create index ai_chat_messages_bot_idx on public.ai_chat_messages (bot_id);

alter table public.ai_chats enable row level security;
create policy "Members see group chats" on public.ai_chats for select to authenticated using (public.is_ai_member());
create policy "Members start group chats" on public.ai_chats for insert to authenticated
  with check (public.is_ai_member() and created_by = (select auth.uid()));
create policy "Members keep chats up to date" on public.ai_chats for update to authenticated
  using (public.is_ai_member()) with check (public.is_ai_member());
create policy "Starters and admins delete chats" on public.ai_chats for delete to authenticated
  using (public.is_ai_member() and (created_by = (select auth.uid()) or public.is_admin()));

alter table public.ai_chat_bots enable row level security;
create policy "Members see who's in a chat" on public.ai_chat_bots for select to authenticated using (public.is_ai_member());
create policy "Members add bots to a chat" on public.ai_chat_bots for insert to authenticated
  with check (public.is_ai_member() and exists (select 1 from public.ai_bots b where b.id = bot_id and b.active));
create policy "Members take bots out of a chat" on public.ai_chat_bots for delete to authenticated using (public.is_ai_member());

alter table public.ai_chat_messages enable row level security;
create policy "Members read group chats" on public.ai_chat_messages for select to authenticated using (public.is_ai_member());
-- People post as themselves. A bot's message is posted (by the server, as
-- the person who pressed the button) only for a bot that's in the chat.
create policy "Members post in group chats" on public.ai_chat_messages for insert to authenticated
  with check (
    public.is_ai_member() and (
      (author_id = (select auth.uid()) and bot_id is null)
      or (author_id is null and exists (select 1 from public.ai_chat_bots cb where cb.chat_id = ai_chat_messages.chat_id and cb.bot_id = ai_chat_messages.bot_id))
    )
  );

revoke all on public.ai_chats, public.ai_chat_bots, public.ai_chat_messages from anon;
revoke update on public.ai_chats from authenticated;
grant update (title, updated_at) on public.ai_chats to authenticated;

create trigger audit_ai_chats after insert or update or delete on public.ai_chats
  for each row execute function public.audit_row();
