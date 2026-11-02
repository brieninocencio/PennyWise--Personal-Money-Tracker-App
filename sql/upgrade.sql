-- Apply after the original PennyWise schema. Adds optimistic concurrency so a
-- stale device cannot silently replace a newer finance snapshot.

alter table public.pennywise_user_data
  add column if not exists revision bigint not null default 0;

create or replace function public.save_pennywise_snapshot(
  p_payload jsonb,
  p_expected_revision bigint default null
)
returns table(status text, revision bigint, payload jsonb)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_revision bigint;
  current_revision bigint;
  current_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'PennyWise payload must be a JSON object';
  end if;

  if p_expected_revision is not null then
    update public.pennywise_user_data
       set payload = p_payload, revision = revision + 1
     where user_id = current_user_id and revision = p_expected_revision
     returning revision into saved_revision;
    if found then
      return query select 'saved'::text, saved_revision, p_payload;
      return;
    end if;
  else
    insert into public.pennywise_user_data (user_id, payload, revision)
    values (current_user_id, p_payload, 1)
    on conflict (user_id) do nothing
    returning revision into saved_revision;
    if found then
      return query select 'saved'::text, saved_revision, p_payload;
      return;
    end if;
  end if;

  select d.revision, d.payload
    into current_revision, current_payload
    from public.pennywise_user_data d
   where d.user_id = current_user_id;
  return query select 'conflict'::text, current_revision, current_payload;
end;
$$;

-- Trigger functions are never public RPC endpoints.
revoke all on function public.handle_new_pennywise_user() from public, anon, authenticated;
revoke all on function public.save_pennywise_snapshot(jsonb, bigint) from public, anon;
grant execute on function public.save_pennywise_snapshot(jsonb, bigint) to authenticated;
