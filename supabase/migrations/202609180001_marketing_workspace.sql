-- Owner-only pilot workspace. Apply after schema.sql.
begin;
create table if not exists public.marketing_workspaces (
  id text primary key,
  revision bigint not null default 0,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  check (octet_length(state::text) <= 8000000)
);
alter table public.marketing_workspaces enable row level security;
revoke all on public.marketing_workspaces from anon, authenticated;
grant select, insert, update on public.marketing_workspaces to service_role;

create or replace function public.marketing_compare_and_swap(p_id text, p_revision bigint, p_state jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  insert into public.marketing_workspaces(id, revision, state)
    values (p_id, 0, '{"version":1,"partners":[],"campaigns":[],"links":[],"clicks":[],"events":[],"spend":[],"audit":[]}'::jsonb)
    on conflict(id) do nothing;
  update public.marketing_workspaces set state = p_state, revision = revision + 1, updated_at = now()
    where id = p_id and revision = p_revision;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.marketing_compare_and_swap(text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.marketing_compare_and_swap(text,bigint,jsonb) to service_role;

-- Legacy APIs are now owner-authenticated; remove the old cross-tenant client policy.
do $$ declare t text; begin
  foreach t in array array['tenants','websites','products','content_pages','metrics_daily','insights','actions','knowledge_chunks'] loop
    execute format('drop policy if exists "allow_all_authenticated" on public.%I', t);
  end loop;
end $$;
commit;
